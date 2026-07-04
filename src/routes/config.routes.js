/**
 * Claude Code Config Routes
 *
 * Browser UI + API to configure ~/.claude/settings.json so Claude Code points
 * at this proxy. Mounted at /config/claude.
 *
 *   GET  /config/claude          -> config UI
 *   GET  /config/claude/state    -> current settings + available models
 *   POST /config/claude/apply    -> merge config into settings.json
 *   POST /config/claude/manual   -> return the manual JSON snippet
 */

import express from 'express';
import {
    CLAUDE_SETTINGS_PATH,
    readClaudeSettings,
    extractConfig,
    buildManualSnippet,
    applyClaudeSettings
} from './claude-config.js';
import { listKiroModels } from '../kiro/index.js';
import { renderPage, ICONS } from '../ui/theme.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/** Sensible default model mapping for Claude Code. */
function defaultConfig(baseUrl) {
    return {
        baseUrl,
        authToken: 'dummy',
        opusModel: 'claude-opus-4-8',
        sonnetModel: 'claude-sonnet-4-5',
        haikuModel: 'claude-haiku-4-5',
        subagentModel: 'claude-sonnet-4-5'
    };
}

/** Base URL Claude Code should use (this proxy, including the /v1 path). */
function suggestedBaseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    return `${proto}://${req.get('host')}/v1`;
}

function modelRow(label, id) {
    return `
      <div class="row">
        <label class="lbl">${label}</label>
        <div class="field-row">
          <input id="${id}" />
          <select onchange="if(this.value){${id}.value=this.value; this.selectedIndex=0;}" id="${id}Sel" aria-label="Select ${label} model"></select>
        </div>
      </div>`;
}

const BODY = /* html */ `
  <div class="page-head">
    <h1>Configure Claude Code</h1>
    <p>Point the Claude Code CLI at this proxy. Only the managed keys in <code>~/.claude/settings.json</code> are changed — your other settings are preserved, and a backup is written first.</p>
  </div>

  <div class="card">
    <div class="actions" style="margin-bottom:18px;">
      <span class="badge" id="conn"><span class="dot"></span> checking…</span>
      <span class="current" id="pathInfo" style="margin-left:auto;"></span>
    </div>

    <div class="row">
      <label class="lbl" for="baseUrl">Endpoint</label>
      <input id="baseUrl" placeholder="http://localhost:4000" />
    </div>
    <div class="row">
      <label class="lbl">Current</label>
      <div class="current" id="current">—</div>
    </div>
    <div class="row">
      <label class="lbl" for="authToken">API Key</label>
      <input id="authToken" placeholder="dummy" />
    </div>
    ${modelRow('Claude Opus', 'opusModel')}
    ${modelRow('Claude Sonnet', 'sonnetModel')}
    ${modelRow('Claude Haiku', 'haikuModel')}
    ${modelRow('Subagent', 'subagentModel')}

    <div class="actions" style="margin-top:20px; padding-top:18px; border-top:1px solid var(--border);">
      <button class="btn primary" onclick="apply()">${ICONS.check} Apply</button>
      <button class="btn" onclick="resetForm()">${ICONS.arrow} Reset</button>
      <button class="btn" onclick="openManual()">${ICONS.copy} Manual Config</button>
    </div>
  </div>

  <div id="status" class="status"></div>

  <div class="overlay" id="overlay" onclick="if(event.target===this)closeManual()">
    <div class="modal">
      <div class="mh">${ICONS.copy} Claude CLI — Manual Configuration</div>
      <div class="mb">
        <div class="actions" style="justify-content:space-between; margin-bottom:10px;">
          <code class="current" id="manualPath">~/.claude/settings.json</code>
          <button class="btn-link" onclick="copyManual()">${ICONS.copy} Copy</button>
        </div>
        <pre id="manualJson">{}</pre>
      </div>
    </div>
  </div>
`;

const SCRIPT = `
  const $ = (id) => document.getElementById(id);
  let MODELS = []; let DEFAULTS = null;
  function show(kind, msg){ const s=$('status'); s.className='status show '+kind; s.textContent=msg; }
  function fillSelect(id){ $(id).innerHTML = '<option value="">Select model…</option>' + MODELS.map(m=>'<option value="'+m+'">'+m+'</option>').join(''); }
  function currentConfig(){ return {
    baseUrl:$('baseUrl').value.trim(), authToken:$('authToken').value.trim(),
    opusModel:$('opusModel').value.trim(), sonnetModel:$('sonnetModel').value.trim(),
    haikuModel:$('haikuModel').value.trim(), subagentModel:$('subagentModel').value.trim() }; }

  async function load(){
    const r = await fetch('/config/claude/state'); const d = await r.json();
    MODELS = d.models || []; DEFAULTS = d.defaults;
    ['opusModelSel','sonnetModelSel','haikuModelSel','subagentModelSel'].forEach(fillSelect);
    const c = (d.current && d.current.baseUrl) ? d.current : d.defaults;
    // Endpoint always defaults to THIS running proxy's URL (its port), not any
    // stale value already in settings.json.
    $('baseUrl').value = d.suggestedBaseUrl;
    $('authToken').value = c.authToken || 'dummy';
    $('opusModel').value = c.opusModel || d.defaults.opusModel;
    $('sonnetModel').value = c.sonnetModel || d.defaults.sonnetModel;
    $('haikuModel').value = c.haikuModel || d.defaults.haikuModel;
    $('subagentModel').value = c.subagentModel || d.defaults.subagentModel;
    const cur = d.current && d.current.baseUrl ? d.current.baseUrl : '(not set)';
    const pointsHere = d.current && d.current.baseUrl === d.suggestedBaseUrl;
    $('current').textContent = cur + (d.current && d.current.baseUrl && !pointsHere ? '  → will change to ' + d.suggestedBaseUrl : '');
    $('pathInfo').textContent = d.settingsPath;
    $('manualPath').textContent = d.settingsPath;
    const configured = pointsHere;
    $('conn').className = 'badge' + (configured ? ' on' : '');
    $('conn').innerHTML = '<span class="dot"></span> ' + (configured ? 'Connected' : 'Not pointing here');
    if (d.error) show('err', d.error);
  }

  function resetForm(){
    $('baseUrl').value = DEFAULTS.baseUrl; $('authToken').value = DEFAULTS.authToken;
    $('opusModel').value = DEFAULTS.opusModel; $('sonnetModel').value = DEFAULTS.sonnetModel;
    $('haikuModel').value = DEFAULTS.haikuModel; $('subagentModel').value = DEFAULTS.subagentModel;
    show('ok', 'Form reset to defaults (not yet applied).');
  }

  async function apply(){
    show('ok', 'Applying…');
    try {
      const r = await fetch('/config/claude/apply', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(currentConfig()) });
      const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.error || 'apply failed');
      show('ok', 'Saved to ' + d.settingsPath + (d.backupPath ? ' (backup: ' + d.backupPath.split('/').pop() + ')' : '') + '. Restart Claude Code to pick it up.');
      load();
    } catch(e){ show('err', e.message); }
  }

  async function openManual(){
    try {
      const r = await fetch('/config/claude/manual', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(currentConfig()) });
      const d = await r.json(); $('manualJson').textContent = d.snippet; $('overlay').classList.add('show');
    } catch(e){ show('err', e.message); }
  }
  function closeManual(){ $('overlay').classList.remove('show'); }
  function copyManual(){ navigator.clipboard.writeText($('manualJson').textContent).then(()=>show('ok','Copied manual config.')); }

  load();
`;

/** GET /config/claude — UI */
router.get('/', (req, res) => {
    res.type('html').send(renderPage({
        title: 'Kiro Claude Proxy — Claude Code Config',
        active: 'config',
        body: BODY,
        script: SCRIPT
    }));
});

/** GET /config/claude/state — current settings + models */
router.get('/state', async (req, res) => {
    try {
        const { exists, settings, error } = readClaudeSettings();
        const current = extractConfig(settings);
        let models = [];
        try {
            const list = await listKiroModels();
            models = (list.data || []).map(m => m.id);
        } catch {
            // Model list is best-effort; the UI still works with free-text.
        }
        res.json({
            settingsPath: CLAUDE_SETTINGS_PATH,
            exists,
            error,
            current,
            models,
            suggestedBaseUrl: suggestedBaseUrl(req),
            defaults: defaultConfig(suggestedBaseUrl(req))
        });
    } catch (error) {
        logger.error('[Config] state error:', error);
        res.status(500).json({ error: error.message });
    }
});

/** POST /config/claude/apply — merge config into settings.json */
router.post('/apply', (req, res) => {
    try {
        const config = req.body || {};
        if (!config.baseUrl) {
            return res.status(400).json({ success: false, error: 'baseUrl is required.' });
        }
        const result = applyClaudeSettings(config);
        logger.success(`[Config] Wrote Claude settings to ${result.settingsPath}`);
        res.json({
            success: true,
            settingsPath: result.settingsPath,
            backupPath: result.backupPath
        });
    } catch (error) {
        logger.error('[Config] apply error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/** POST /config/claude/manual — build the manual JSON snippet */
router.post('/manual', (req, res) => {
    try {
        const snippet = buildManualSnippet(req.body || {});
        res.json({ snippet, settingsPath: CLAUDE_SETTINGS_PATH });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
