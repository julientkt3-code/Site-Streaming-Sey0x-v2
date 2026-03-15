import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the dist folder
app.use(express.static(path.join(__dirname, 'dist')));

// Keep-alive ping endpoint (pour éviter la mise en veille sur Render plan gratuit)
app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback: all routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`HaloStream server running on port ${PORT}`);
});
