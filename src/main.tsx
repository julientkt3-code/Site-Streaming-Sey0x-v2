import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Enregistrement du Service Worker AdBlock
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[SW AdBlock] Actif sur:', reg.scope);
        // Forcer la mise à jour si une nouvelle version est disponible
        reg.addEventListener('updatefound', () => {
          reg.installing?.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'installed') {
              navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(err => console.warn('[SW AdBlock] Non disponible:', err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
