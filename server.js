import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────
// Headers de sécurité — bloquent les popups au niveau navigateur
// INVISIBLES pour les lecteurs (ils ne peuvent pas les détecter)
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  // Bloque window.open, les nouvelles fenêtres et la navigation top-level
  // depuis toutes les iframes de la page
  res.setHeader(
    'Permissions-Policy',
    'popups=(), popups-to-escape-sandbox=(), top-navigation=(), top-navigation-by-user-activation=()'
  );

  // Content-Security-Policy : interdit les popups et les navigations forcées
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self' https: data: blob:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "frame-src *",          // autoriser tous les lecteurs
      "frame-ancestors 'self'",
    ].join('; ')
  );

  // Empêche le site d'être chargé dans une iframe par un tiers (clickjacking)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  next();
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
