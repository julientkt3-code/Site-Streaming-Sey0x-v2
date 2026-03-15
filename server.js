import express from 'express';
import path from 'path';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────
// Headers globaux
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy',
    'popups=(), popups-to-escape-sandbox=(), top-navigation=(), top-navigation-by-user-activation=()'
  );
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// ─────────────────────────────────────────────────────────────
// PROXY — charge le lecteur côté serveur, injecte notre script
// anti-pub dedans, puis le sert comme si c'était notre domaine
// Les popups ne peuvent plus s'ouvrir car window.open est écrasé
// AVANT que le JS du lecteur s'exécute
// ─────────────────────────────────────────────────────────────

// Script injecté dans chaque page proxifiée
const INJECTED_SCRIPT = `
<script>
(function(){
  // Écraser window.open avant tout le reste
  window.open = function(){ return null; };
  // Bloquer les navigations
  var _origAssign = null;
  try { _origAssign = location.assign.bind(location); location.assign = function(){}; } catch(e){}
  try { location.replace = function(){}; } catch(e){}
  // Bloquer les liens _blank
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if(a && (a.target === '_blank' || a.target === '_new')){
      a.target = '_self';
    }
  }, true);
  // Bloquer les schémas d'app
  var _badSchemes = ['intent:','market:','android-app:','ios-app:','fb:','callto:'];
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if(a && a.href){
      var h = a.href.toLowerCase();
      if(_badSchemes.some(function(s){ return h.indexOf(s) === 0; })){
        e.preventDefault(); e.stopImmediatePropagation();
      }
    }
  }, true);
  // Patch window.open sur les iframes filles
  var _obs = new MutationObserver(function(muts){
    muts.forEach(function(m){
      m.addedNodes.forEach(function(n){
        if(n.tagName === 'IFRAME'){
          try {
            n.addEventListener('load', function(){
              try { n.contentWindow.open = function(){ return null; }; } catch(e){}
            });
          } catch(e){}
        }
      });
    });
  });
  try { _obs.observe(document.documentElement, {childList:true, subtree:true}); } catch(e){}
})();
</script>
`;

// Fonction fetch côté Node (sans dépendance externe)
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000,
    }, (res) => {
      // Suivre les redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Route proxy : /proxy?url=https://vidsrc.su/...
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing url');

  // Sécurité : uniquement les lecteurs connus
  const allowed = [
    'vidsrc.su','vidsrc.xyz','vidsrc.me','vidsrc.vip','vidsrc.in',
    'vidfast.pro','player.videasy.net','embed.su','player.autoembed.cc',
    '2embed.cc','www.2embed.cc',
  ];
  try {
    const hostname = new URL(targetUrl).hostname;
    if (!allowed.some(a => hostname === a || hostname.endsWith('.' + a))) {
      return res.status(403).send('Domaine non autorisé');
    }
  } catch {
    return res.status(400).send('URL invalide');
  }

  try {
    const { status, headers, body } = await fetchUrl(targetUrl);
    const contentType = headers['content-type'] || 'text/html';

    // Ne modifier que le HTML — injecter notre script anti-pub
    if (contentType.includes('text/html')) {
      // Réécrire les URLs relatives en absolues pour que les ressources chargent
      const baseHost = new URL(targetUrl).origin;
      let modified = body;

      // Injecter notre script le plus tôt possible dans le <head>
      if (modified.includes('<head>')) {
        modified = modified.replace('<head>', '<head>' + INJECTED_SCRIPT);
      } else if (modified.includes('<html')) {
        modified = modified.replace(/<html[^>]*>/, (m) => m + INJECTED_SCRIPT);
      } else {
        modified = INJECTED_SCRIPT + modified;
      }

      // Réécrire les src/href relatifs
      modified = modified
        .replace(/(src|href)=["']\/(?!\/)/g, `$1="${baseHost}/`)
        .replace(/(src|href)=["'](?!http|\/\/|data:|blob:|#)/g, `$1="${baseHost}/`);

      res.status(status).set('Content-Type', 'text/html; charset=utf-8').send(modified);
    } else {
      // Pour les autres ressources (JS, CSS, images) : passer tel quel
      res.status(status).set('Content-Type', contentType).send(body);
    }
  } catch (err) {
    console.error('[Proxy] Erreur:', err.message);
    res.status(502).send('Proxy error: ' + err.message);
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Keep-alive ping
app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sey0x server running on port ${PORT}`);
});
