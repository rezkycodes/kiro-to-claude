/**
 * OAuth Routes for Kiro
 *
 * Express router that exposes a browser-driven Kiro sign-in flow plus
 * auto-import and manual token import. Mounted at /oauth/kiro.
 *
 *   GET  /oauth/kiro                 -> HTML sign-in UI
 *   GET  /oauth/kiro/authorize       -> build social login URL (?provider=)
 *   POST /oauth/kiro/exchange        -> exchange callback code for tokens
 *   GET  /oauth/kiro/sources         -> list local credential sources
 *   GET  /oauth/kiro/auto-import     -> import from Kiro CLI DB / AWS SSO cache
 *   POST /oauth/kiro/import          -> import a pasted refresh token
 *   GET  /oauth/kiro/status          -> current stored credential status
 *
 * All successful flows persist credentials to the proxy token store, so the
 * auto-refresh mechanism keeps them alive.
 *
 * SECURITY: these endpoints handle OAuth tokens and have no authentication of
 * their own. Only expose the proxy on a trusted (localhost) interface.
 */

import express from 'express';
import {
    generatePKCE,
    buildSocialLoginUrl,
    exchangeSocialCode,
    parseCallback,
    extractEmailFromJWT,
    discoverAllCredentialSources,
    discoverLocalCredentials,
    validateAndBuildCredentials
} from '../auth/kiro-oauth.js';
import { saveKiroCredentials, isKiroAuthenticated } from '../auth/kiro-token-extractor.js';
import { renderPage, ICONS } from '../ui/theme.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const BODY = /* html */ `
  <div class="page-head">
    <h1>Sign in to Kiro</h1>
    <p>Authenticate so the proxy can reach Claude models. Tokens are stored locally and refreshed automatically — you stay signed in until you log out.</p>
  </div>

  <div class="card" style="margin-bottom:24px;">
    <span class="badge" id="currentStatus"><span class="dot"></span> checking…</span>
  </div>

  <div class="section" style="margin-top:0; border-top:none; padding-top:0;">
    <h2>1 · Social login</h2>
    <div class="actions">
      <button class="btn" onclick="startSocial('google')">${ICONS.key} Login with Google</button>
      <button class="btn" onclick="startSocial('github')">${ICONS.key} Login with GitHub</button>
    </div>
    <div id="callbackBox" style="display:none; margin-top:16px;" class="stack">
      <small class="hint">A login tab opened. After you approve, your browser tries to open a <code>kiro://…</code> link and shows "can't open". Copy that full URL (or just the code) and paste it below.</small>
      <div>
        <label class="lbl" for="callback">Callback URL or code</label>
        <textarea id="callback" placeholder="kiro://kiro.kiroAgent/authenticate-success?code=...&state=..."></textarea>
      </div>
      <button class="btn primary" onclick="completeSocial()">${ICONS.check} Complete sign in</button>
    </div>
  </div>

  <div class="section">
    <h2>2 · Auto-import (this machine)</h2>
    <small class="hint">Import a token detected on this machine — Kiro IDE, Kiro CLI, or AWS SSO cache. Expired tokens are refreshed on import.</small>
    <div id="sourceList" class="stack" style="margin-top:14px;"></div>
    <button class="btn sm" style="margin-top:12px;" onclick="loadSources()">${ICONS.pulse} Rescan sources</button>
  </div>

  <div class="section">
    <h2>3 · Manual import</h2>
    <div class="stack">
      <div>
        <label class="lbl" for="refreshToken">Refresh token</label>
        <input id="refreshToken" placeholder="aorAAAAAG..." />
      </div>
      <details>
        <summary class="hint" style="cursor:pointer;">Enterprise / IDC options (clientId, clientSecret, region)</summary>
        <div class="stack" style="margin-top:12px;">
          <div><label class="lbl" for="clientId">Client ID</label><input id="clientId" /></div>
          <div><label class="lbl" for="clientSecret">Client Secret</label><input id="clientSecret" /></div>
          <div><label class="lbl" for="region">Region</label><input id="region" value="us-east-1" /></div>
        </div>
      </details>
      <button class="btn primary" onclick="manualImport()">${ICONS.check} Import token</button>
    </div>
  </div>

  <div id="status" class="status"></div>
`;

const SCRIPT = `
  let pkce = null;
  const $ = (id) => document.getElementById(id);
  function show(kind, msg) { const s=$('status'); s.className='status show '+kind; s.textContent=msg; }

  async function refreshCurrent() {
    try {
      const r = await fetch('/oauth/kiro/status'); const d = await r.json();
      const el = $('currentStatus');
      el.className = 'badge' + (d.authenticated ? ' on' : '');
      el.innerHTML = '<span class="dot"></span> ' + (d.authenticated ? 'Signed in' : 'Not signed in yet');
    } catch {}
  }

  async function startSocial(provider) {
    show('ok', 'Preparing ' + provider + ' login…');
    try {
      const r = await fetch('/oauth/kiro/authorize?provider=' + provider);
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'authorize failed');
      pkce = { codeVerifier: d.codeVerifier, state: d.state, provider };
      window.open(d.authUrl, '_blank');
      $('callbackBox').style.display = 'flex';
      show('ok', 'Login tab opened. Paste the callback URL below to finish.');
    } catch (e) { show('err', e.message); }
  }

  async function completeSocial() {
    if (!pkce) return show('err', 'Start a social login first.');
    show('ok', 'Exchanging code…');
    try {
      const r = await fetch('/oauth/kiro/exchange', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ callback: $('callback').value, codeVerifier: pkce.codeVerifier, state: pkce.state, provider: pkce.provider }) });
      const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.error || 'exchange failed');
      show('ok', 'Signed in' + (d.email ? ' as ' + d.email : '') + '. Token stored & auto-refresh enabled.');
      refreshCurrent();
    } catch (e) { show('err', e.message); }
  }

  async function loadSources() {
    const box = $('sourceList'); box.innerHTML = '<small class="hint">Scanning…</small>';
    try {
      const r = await fetch('/oauth/kiro/sources'); const d = await r.json();
      if (!d.sources || !d.sources.length) { box.innerHTML = '<small class="hint">No local Kiro credentials found. Use social login or manual import.</small>'; return; }
      box.innerHTML = '';
      for (const s of d.sources) {
        const exp = s.expiresAt ? (s.expired ? ' · expired (will refresh)' : ' · valid') : '';
        const meta = [s.provider, s.authType].filter(Boolean).join(' · ');
        const btn = document.createElement('button');
        btn.className = 'btn block'; btn.style.justifyContent = 'space-between';
        btn.innerHTML = '<span>Import from ' + s.label + (meta ? '  (' + meta + ')' : '') + exp + '</span>';
        btn.onclick = () => autoImport(s.id, s.label);
        box.appendChild(btn);
      }
    } catch (e) { box.innerHTML = '<small class="hint">Failed to scan: ' + e.message + '</small>'; }
  }

  async function autoImport(sourceId, label) {
    show('ok', 'Importing from ' + (label || 'source') + '…');
    try {
      const r = await fetch('/oauth/kiro/auto-import', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ source: sourceId }) });
      const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.error || 'auto-import failed');
      show('ok', 'Imported from ' + (d.label || d.source) + (d.email ? ' (' + d.email + ')' : '') + '. Token stored & auto-refresh enabled.');
      refreshCurrent();
    } catch (e) { show('err', e.message); }
  }

  async function manualImport() {
    const refreshToken = $('refreshToken').value.trim();
    if (!refreshToken) return show('err', 'Enter a refresh token.');
    show('ok', 'Validating token…');
    try {
      const r = await fetch('/oauth/kiro/import', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ refreshToken, clientId: $('clientId').value.trim() || undefined, clientSecret: $('clientSecret').value.trim() || undefined, region: $('region').value.trim() || undefined }) });
      const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.error || 'import failed');
      show('ok', 'Token imported' + (d.email ? ' (' + d.email + ')' : '') + '. Stored & auto-refresh enabled.');
      refreshCurrent();
    } catch (e) { show('err', e.message); }
  }

  refreshCurrent();
  loadSources();
`;

/** GET /oauth/kiro — sign-in UI */
router.get('/', (req, res) => {
    res.type('html').send(renderPage({
        title: 'Kiro to Claude — Sign in',
        active: 'signin',
        body: BODY,
        script: SCRIPT
    }));
});

/** GET /oauth/kiro/status — current credential status */
router.get('/status', (req, res) => {
    try {
        const authed = isKiroAuthenticated();
        res.json({ authenticated: authed });
    } catch {
        res.json({ authenticated: false });
    }
});

/** GET /oauth/kiro/authorize?provider=google|github */
router.get('/authorize', (req, res) => {
    try {
        const provider = req.query.provider;
        if (!provider || !['google', 'github'].includes(provider)) {
            return res.status(400).json({ error: "Invalid provider. Use 'google' or 'github'." });
        }
        const { codeVerifier, codeChallenge, state } = generatePKCE();
        const authUrl = buildSocialLoginUrl(provider, codeChallenge, state);
        res.json({ authUrl, state, codeVerifier, provider });
    } catch (error) {
        logger.error('[Kiro OAuth] authorize error:', error);
        res.status(500).json({ error: error.message });
    }
});

/** POST /oauth/kiro/exchange — exchange callback code for tokens */
router.post('/exchange', async (req, res) => {
    try {
        const { callback, code: rawCode, codeVerifier, state, provider } = req.body || {};
        if (!codeVerifier) {
            return res.status(400).json({ error: 'Missing codeVerifier. Start the login again.' });
        }

        // Accept either a pasted callback URL or a raw code.
        let code = rawCode;
        if (!code && callback) {
            const parsed = parseCallback(callback);
            code = parsed.code;
            // Best-effort CSRF check when the callback carries state.
            if (parsed.state && state && parsed.state !== state) {
                return res.status(400).json({ error: 'State mismatch — possible CSRF. Restart the login.' });
            }
        }
        if (!code) {
            return res.status(400).json({ error: 'No authorization code found in the callback.' });
        }

        const tokenData = await exchangeSocialCode(code, codeVerifier);
        const email = extractEmailFromJWT(tokenData.accessToken);

        saveKiroCredentials({
            authKey: 'kirocli:social:token',
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            expiresAt: new Date(Date.now() + (tokenData.expiresIn || 3600) * 1000),
            region: 'us-east-1',
            profileArn: tokenData.profileArn || null,
            provider: provider || 'social'
        });

        res.json({ success: true, email });
    } catch (error) {
        logger.error('[Kiro OAuth] exchange error:', error);
        res.status(500).json({ error: error.message });
    }
});

/** GET /oauth/kiro/sources — list discoverable local credential sources */
router.get('/sources', async (req, res) => {
    try {
        const all = await discoverAllCredentialSources();
        const sources = all.map(s => {
            const expiresAt = s.expiresAt || null;
            const expired = expiresAt ? new Date(expiresAt) <= new Date() : null;
            return {
                id: s.source,
                label: s.label || s.source,
                provider: s.provider || null,
                authType: s.authKey && s.authKey.includes('social') ? 'social' : 'sso',
                expiresAt,
                expired,
                hasProfileArn: !!s.profileArn
            };
        });
        res.json({ sources });
    } catch (error) {
        logger.error('[Kiro OAuth] sources error:', error);
        res.status(500).json({ sources: [], error: error.message });
    }
});

/**
 * GET  /oauth/kiro/auto-import[?source=ID]
 * POST /oauth/kiro/auto-import  { source }
 * Import from a specific local source, or the highest-priority one if omitted.
 */
async function handleAutoImport(req, res) {
    try {
        const sourceId = (req.body && req.body.source) || req.query.source || null;
        const discovered = await discoverLocalCredentials(sourceId);
        if (!discovered) {
            return res.status(404).json({
                success: false,
                error: sourceId
                    ? `Source "${sourceId}" not found or has no valid token.`
                    : 'No local Kiro credentials found (Kiro CLI DB or AWS SSO cache). Sign in with Kiro first.'
            });
        }

        const creds = await validateAndBuildCredentials(discovered);
        const email = extractEmailFromJWT(creds.accessToken);
        saveKiroCredentials(creds);

        res.json({
            success: true,
            source: discovered.source,
            label: discovered.label || discovered.source,
            email
        });
    } catch (error) {
        logger.error('[Kiro OAuth] auto-import error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

router.get('/auto-import', handleAutoImport);
router.post('/auto-import', handleAutoImport);

/** POST /oauth/kiro/import — import a pasted refresh token */
router.post('/import', async (req, res) => {
    try {
        const { refreshToken, clientId, clientSecret, region, profileArn } = req.body || {};
        if (!refreshToken || typeof refreshToken !== 'string') {
            return res.status(400).json({ error: 'Refresh token is required.' });
        }

        const isIdc = !!(clientId && clientSecret);
        const discovered = {
            authKey: isIdc ? 'kirocli:odic:token' : 'kirocli:social:token',
            refreshToken: refreshToken.trim(),
            region: region || 'us-east-1',
            profileArn: profileArn || null,
            provider: isIdc ? 'idc' : 'imported',
            clientId: clientId || null,
            clientSecret: clientSecret || null
        };

        const creds = await validateAndBuildCredentials(discovered);
        const email = extractEmailFromJWT(creds.accessToken);
        saveKiroCredentials(creds);

        res.json({ success: true, email });
    } catch (error) {
        logger.error('[Kiro OAuth] import error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
