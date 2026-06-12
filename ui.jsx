// main.jsx — Vite entry. Import order MATTERS and mirrors the old index.html <script> order:
// globals first (defines window.React), then libs that publish onto window.QA / window.*,
// and finally app.jsx, which renders into #root on import.
import './globals.js';
import './tweaks-panel.jsx';
import './data.js';
import './api.js';
import './ui.jsx';
import './audit.jsx';
import './analytics.jsx';
import './summary.jsx';
import './performance.jsx';
import './auth.js';   // optional Google sign-in (no-op unless VITE_GOOGLE_CLIENT_ID is set)
import './app.jsx';   // mounts <App /> into #root
