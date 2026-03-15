import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy',
    'popups=(), popups-to-escape-sandbox=(), top-navigation=(), top-navigation-by-user-activation=()'
  );
  next();
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('/ping', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`Sey0x running on port ${PORT}`));
