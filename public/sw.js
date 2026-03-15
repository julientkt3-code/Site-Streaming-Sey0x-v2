// Service Worker — intercepte toutes les navigations
// et bloque celles qui vont vers des domaines externes non autorisés

const OWN_ORIGIN = self.location.origin;

const ALLOWED_ORIGINS = [
  OWN_ORIGIN,
  'https://vidsrc.su',
  'https://vidfast.pro',
  'https://player.videasy.net',
  'https://embed.su',
  'https://vidsrc.vip',
  'https://player.autoembed.cc',
  'https://www.2embed.cc',
  'https://image.tmdb.org',
  'https://api.themoviedb.org',
];

const isAllowed = (url) => {
  try {
    const u = new URL(url);
    return ALLOWED_ORIGINS.some(o => url.startsWith(o)) ||
           u.hostname.includes('tmdb.org') ||
           u.hostname.includes('vidsrc') ||
           u.hostname.includes('vidfast') ||
           u.hostname.includes('videasy') ||
           u.hostname.includes('embed.su') ||
           u.hostname.includes('autoembed') ||
           u.hostname.includes('2embed');
  } catch { return false; }
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Intercepter les navigations (fetch de type 'navigate')
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Bloquer uniquement les navigate (changements de page) vers l'extérieur
  if (request.mode === 'navigate') {
    const url = request.url;
    if (!isAllowed(url)) {
      console.log('[SW] Navigation bloquée:', url);
      // Retourner la page actuelle au lieu de naviguer
      event.respondWith(
        caches.match('/index.html').then(r => r || fetch('/index.html'))
      );
      return;
    }
  }

  // Laisser passer tout le reste
  event.respondWith(fetch(request).catch(() => new Response('', { status: 200 })));
});
