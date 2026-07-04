/**
 * Shared UI theme + page shell for all proxy web pages.
 *
 * Design system (via ui-ux-pro-max, "Exaggerated Minimalism"):
 *   - Monochrome black/white, base background #000000
 *   - Fira Sans (body) / Fira Code (mono), high contrast, generous whitespace
 *   - SVG icons only, visible focus states, reduced-motion support, responsive
 *
 * Every page uses renderPage() so the header, navigation, and styling stay
 * consistent across the dashboard, sign-in, and config screens.
 */

/** Inline SVG icons (stroke-based, single visual language). */
export const ICONS = {
    logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M16 7l3 3M14 9l3 3"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/></svg>',
    pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
};

/** Shared stylesheet — monochrome tokens + components. */
export const THEME_CSS = /* css */ `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

:root {
  --bg: #000000;
  --surface: #0a0a0a;
  --surface-2: #121212;
  --surface-3: #1a1a1a;
  --border: #262626;
  --border-strong: #3a3a3a;
  --fg: #fafafa;
  --muted: #a1a1a1;
  --muted-2: #6f6f6f;
  --accent: #ffffff;
  --on-accent: #000000;
  --ring: #ffffff;
  --radius: 14px;
  --radius-sm: 9px;
  --maxw: 960px;
  --sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  color-scheme: dark;
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  min-height: 100dvh;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.6;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }

/* subtle grid backdrop */
body::before {
  content: "";
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(var(--surface) 1px, transparent 1px),
    linear-gradient(90deg, var(--surface) 1px, transparent 1px);
  background-size: 48px 48px;
  -webkit-mask-image: radial-gradient(circle at 50% 0%, #000 0%, transparent 70%);
          mask-image: radial-gradient(circle at 50% 0%, #000 0%, transparent 70%);
  opacity: .5;
}

/* ---- Header / nav ---- */
.hdr {
  position: sticky; top: 0; z-index: 40;
  background: rgba(0,0,0,.72);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.hdr-in {
  max-width: var(--maxw); margin: 0 auto; padding: 0 20px;
  height: 60px; display: flex; align-items: center; gap: 20px;
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 600; letter-spacing: -0.02em; }
.brand .mark {
  width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center;
  background: var(--accent); color: var(--on-accent);
}
.brand small { display:block; font-size: 11px; color: var(--muted-2); font-weight: 400; letter-spacing: 0; }
.nav { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.nav a {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: var(--radius-sm); font-size: 13px; color: var(--muted);
  min-height: 40px; transition: background .16s ease, color .16s ease;
}
.nav a:hover { color: var(--fg); background: var(--surface-2); }
.nav a.active { color: var(--fg); background: var(--surface-3); }
.nav a svg { opacity: .9; }
.nav-labels { }
@media (max-width: 640px) {
  .brand small { display: none; }
  .nav a { padding: 8px; }
  .nav-labels { display: none; }
}

/* ---- Layout ---- */
main { position: relative; z-index: 1; max-width: var(--maxw); margin: 0 auto; padding: 40px 20px 80px; }
.page-head { margin-bottom: 32px; }
.page-head h1 {
  margin: 0 0 8px; font-size: clamp(1.9rem, 5vw, 3rem); font-weight: 700;
  letter-spacing: -0.04em; line-height: 1.05;
}
.page-head p { margin: 0; color: var(--muted); font-size: 15px; max-width: 60ch; }

/* ---- Cards ---- */
.card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 22px;
}
.grid { display: grid; gap: 16px; }
.grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 760px) { .grid.cols-2, .grid.cols-3 { grid-template-columns: 1fr; } }

/* menu card (link) */
.menu-card {
  display: flex; flex-direction: column; gap: 14px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 22px; min-height: 150px; cursor: pointer;
  transition: border-color .16s ease, background .16s ease, transform .16s ease;
}
.menu-card:hover { border-color: var(--border-strong); background: var(--surface-2); transform: translateY(-2px); }
.menu-card .ic {
  width: 42px; height: 42px; border-radius: 11px; display: grid; place-items: center;
  background: var(--surface-3); border: 1px solid var(--border); color: var(--fg);
}
.menu-card h3 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.02em; display:flex; align-items:center; gap:8px; }
.menu-card p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.5; flex: 1; }
.menu-card .go { display:flex; align-items:center; gap:6px; font-size: 12px; color: var(--muted-2); }
.menu-card:hover .go { color: var(--fg); }

/* ---- Rows / forms (shadcn/ui-style) ---- */
.row { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 16px; margin-bottom: 14px; }
@media (max-width: 620px) { .row { grid-template-columns: 1fr; gap: 6px; } }
label.lbl { font-size: 13px; color: var(--muted); font-weight: 500; }
input, select, textarea {
  width: 100%; height: 36px; background: transparent; border: 1px solid var(--border); color: var(--fg);
  border-radius: 6px; padding: 0 12px; font-size: 14px; line-height: 1.4; font-family: var(--sans);
  box-shadow: 0 1px 2px 0 rgba(0,0,0,.3);
  transition: border-color .15s ease, box-shadow .15s ease;
}
select {
  appearance: none; -webkit-appearance: none; cursor: pointer; padding-right: 34px;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a1a1a1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 11px center;
}
select option { background: var(--surface); color: var(--fg); }
textarea { height: auto; min-height: 76px; padding: 8px 12px; resize: vertical; line-height: 1.5; }
input:hover, select:hover, textarea:hover { border-color: var(--border-strong); }
input:focus, select:focus, textarea:focus,
input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: none; border-color: var(--ring);
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px rgba(255,255,255,.32);
}
input::placeholder, textarea::placeholder { color: var(--muted-2); }
input:disabled, select:disabled, textarea:disabled { opacity: .5; cursor: not-allowed; }
.field-row { display: flex; gap: 8px; }
.field-row input { flex: 1; }
.field-row select { width: 180px; }
.current { font-size: 12px; color: var(--muted-2); font-family: var(--sans); word-break: break-all; }
small.hint { font-size: 11px; color: var(--muted-2); }

/* ---- Buttons (shadcn/ui-style) ---- */
.btn {
  appearance: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  white-space: nowrap; height: 36px; padding: 0 16px; border-radius: 6px; font-size: 14px; font-weight: 500;
  font-family: var(--sans); border: 1px solid var(--border); background: transparent; color: var(--fg);
  box-shadow: 0 1px 2px 0 rgba(0,0,0,.3);
  transition: background .15s ease, color .15s ease, border-color .15s ease, opacity .15s ease;
}
.btn:hover { background: var(--surface-2); }
.btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px rgba(255,255,255,.32); }
.btn:disabled { opacity: .5; pointer-events: none; }
.btn.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.btn.primary:hover { background: #e6e6e6; border-color: #e6e6e6; }
.btn.block { width: 100%; }
.btn.sm { height: 32px; padding: 0 12px; font-size: 13px; }
.btn-link { background: none; border: none; box-shadow: none; color: var(--muted); cursor: pointer; font-size: 13px; display:inline-flex; align-items:center; gap:6px; padding: 4px; font-family: var(--sans); }
.btn-link:hover { color: var(--fg); background: none; text-decoration: underline; text-underline-offset: 4px; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }

/* ---- Badges / status ---- */
.badge {
  display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500;
  padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border-strong); color: var(--muted);
  font-family: var(--sans);
}
.badge.on { color: var(--on-accent); background: var(--accent); border-color: var(--accent); }
.badge .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

.status { margin-top: 16px; padding: 12px 14px; border-radius: var(--radius-sm); font-size: 13px; display: none; border: 1px solid var(--border-strong); background: var(--surface-2); }
.status.show { display: block; }
.status.ok { border-color: var(--fg); }
.status.err { border-color: var(--border-strong); background: var(--surface-3); }
.status.err::before { content: "! "; font-weight: 700; }

/* ---- Section ---- */
.section { margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--border); }
.section h2 { font-size: 13px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin: 0 0 16px; }
.stack { display: flex; flex-direction: column; gap: 12px; }

/* ---- Modal ---- */
.overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; padding: 20px; }
.overlay.show { display: flex; }
.modal { width: 100%; max-width: 560px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius); overflow: hidden; }
.modal .mh { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 600; }
.modal .mb { padding: 16px 18px; }
pre { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; font-size: 12px; overflow: auto; margin: 0; white-space: pre; color: var(--fg); font-family: var(--mono); }

/* ---- Accessibility ---- */
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.skip { position: absolute; left: -999px; top: 8px; background: var(--accent); color: var(--on-accent); padding: 8px 14px; border-radius: 8px; z-index: 200; }
.skip:focus { left: 12px; }

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: .001ms !important; transition-duration: .001ms !important; }
  .menu-card:hover { transform: none; }
}
`;

/**
 * Build the top navigation, marking the active item.
 * @param {string} active - key of the active nav item
 */
function nav(active) {
    const items = [
        { key: 'dashboard', href: '/', label: 'Dashboard', icon: ICONS.dashboard },
        { key: 'signin', href: '/oauth/kiro', label: 'Sign in', icon: ICONS.key },
        { key: 'config', href: '/config/claude', label: 'Claude Config', icon: ICONS.sliders }
    ];
    return items.map(i =>
        `<a href="${i.href}"${i.key === active ? ' class="active" aria-current="page"' : ''}>${i.icon}<span class="nav-labels">${i.label}</span></a>`
    ).join('');
}

/**
 * Render a full HTML page with the shared shell.
 * @param {Object} opts
 * @param {string} opts.title - page <title>
 * @param {string} opts.active - active nav key (dashboard|signin|config)
 * @param {string} opts.body - main content HTML
 * @param {string} [opts.script] - page JS (without <script> tags)
 * @param {string} [opts.head] - extra head HTML (page-specific CSS)
 * @returns {string}
 */
export function renderPage({ title, active, body, script = '', head = '' }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>${THEME_CSS}</style>
${head}
</head>
<body>
<a href="#main" class="skip">Skip to content</a>
<header class="hdr">
  <div class="hdr-in">
    <a class="brand" href="/">
      <span class="mark">${ICONS.logo}</span>
      <span>Kiro to Claude<small>Anthropic-compatible gateway</small></span>
    </a>
    <nav class="nav" aria-label="Primary">${nav(active)}</nav>
  </div>
</header>
<main id="main">
${body}
</main>
${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}

export default { THEME_CSS, ICONS, renderPage };
