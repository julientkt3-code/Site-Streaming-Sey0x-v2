// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER — AdBlock intégré (logique ABP/uBlock)
// Intercepte TOUTES les requêtes réseau et bloque celles qui
// correspondent aux listes de filtres publicitaires
// ═══════════════════════════════════════════════════════════════

const OWN_ORIGIN = self.location.origin;

// ── Liste de domaines bloqués (style EasyList / ABP) ───────────
const BLOCKED_DOMAINS = new Set([
  // Réseaux pub majeurs
  'doubleclick.net','googlesyndication.com','googleadservices.com',
  'adservice.google.com','pagead2.googlesyndication.com','adwords.google.com',
  'adnxs.com','rubiconproject.com','pubmatic.com','openx.net','openx.com',
  'casalemedia.com','criteo.com','criteo.net','adsrvr.org','moatads.com',
  'advertising.com','adbrite.com','adform.net','adroll.com','adroll.com',
  'outbrain.com','taboola.com','revcontent.com','mgid.com','mgid.ru',
  'sharethrough.com','triplelift.com','sovrn.com','lijit.com',
  'contextweb.com','smartadserver.com','appnexus.com','indexexchange.com',
  'lkqd.net','spotxchange.com','spotx.tv','springserve.com','teads.tv',
  'yieldmo.com','33across.com','rhythmone.com','undertone.com',
  'conversantmedia.com','dotomi.com','bidswitch.net','media.net',
  'adsymptotic.com','adtrue.com','scorecardresearch.com','quantserve.com',
  'bluekai.com','exelator.com','turn.com','eyeota.net','adsystem.com',
  // Spécialisés streaming/adult/popups
  'clickadu.com','popcash.net','popads.net','adcash.com','adcash.net',
  'propellerads.com','propeller.app','hilltopads.net','hilltopads.com',
  'trafficjunky.net','exoclick.com','juicyads.com','trafficforce.com',
  'plugrush.com','adspyglass.com','adxpansion.com','ero-advertising.com',
  'tsyndicate.com','traffic-media.co','trafficshop.com','adcolony.com',
  'applovin.com','vungle.com','mocopay.net','realsrv.com','tmia.com',
  'adtng.com','moonads.com','bidvertiser.com','adsterra.com','adsterra.com',
  'admaven.com','onevideo.aol.com','popunder.net','pop-ads.net',
  'zeroredirect1.com','zeroredirect2.com','tra.fi','ero.com',
  'tubecorporate.com','juicy.media','cdn.trafficjunky.net',
  'static.clickadu.com','cdn.adsterra.com','syndication.exoclick.com',
  'go.bidvertiser.com','ads.adsterra.com','srv.clickadu.com',
  // Trackers
  'analytics.google.com','google-analytics.com','googletagmanager.com',
  'googletagservices.com','hotjar.com','mixpanel.com','amplitude.com',
  'segment.io','segment.com','fullstory.com','logrocket.com',
  // CDN pub
  'cdn.adnxs.com','ib.adnxs.com','secure.adnxs.com',
  'pixel.rubiconproject.com','fastlane.rubiconproject.com',
  'ads.pubmatic.com','image6.pubmatic.com','simage2.pubmatic.com',
  'prebid.org','prebid.js',
  // Redirecteurs / interstitiels
  'go2speed.org','megaimpresion.com','seedtag.com','2mdn.net',
  'admeld.com','adsenseoptimizer.com','adshuffle.com',
]);

// ── Patterns URL bloqués (regex-like) ─────────────────────────
const BLOCKED_PATTERNS = [
  /\/ads?\//i, /\/advert/i, /\/banner/i, /\/popup/i, /\/popunder/i,
  /\/redirect/i, /\/tracking/i, /\/tracker/i, /\/clicktrack/i,
  /\/affiliate/i, /\/sponsor/i, /adserver/i, /adnetwork/i,
  /go\.php\?/i, /out\.php\?/i, /click\.php\?/i, /track\.php\?/i,
  /\/imp\?/i, /\/pixel\?/i, /\/beacon\?/i,
  /[?&]adid=/i, /[?&]utm_source=ad/i,
];

// ── Domaines TOUJOURS autorisés (lecteurs + ressources du site) ─
const ALWAYS_ALLOWED = [
  OWN_ORIGIN,
  'vidsrc.su','vidsrc.xyz','vidsrc.me','vidsrc.vip','vidsrc.in',
  'vidfast.pro','player.videasy.net','embed.su','player.autoembed.cc',
  'www.2embed.cc','2embed.cc',
  'api.themoviedb.org','image.tmdb.org','themoviedb.org',
  'fonts.googleapis.com','fonts.gstatic.com',
  'cdn.jsdelivr.net','cdnjs.cloudflare.com',
  // Sous-domaines des lecteurs
  '.vidsrc.su','.vidsrc.xyz','.vidfast.pro','.embed.su',
];

const isAlwaysAllowed = (url) => {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return ALWAYS_ALLOWED.some(a => h === a || h.endsWith('.' + a) || url.startsWith(a));
  } catch { return false; }
};

const isDomainBlocked = (url) => {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    // Vérifier domaine exact + tous les sous-domaines
    for (const blocked of BLOCKED_DOMAINS) {
      if (h === blocked || h.endsWith('.' + blocked)) return true;
    }
    // Vérifier patterns URL
    if (BLOCKED_PATTERNS.some(p => p.test(url))) return true;
    return false;
  } catch { return false; }
};

// ── Schémas d'app mobile — toujours bloquer ───────────────────
const BAD_SCHEMES = ['intent:','market:','android-app:','ios-app:','itms-apps:','itms:','fb:','callto:'];
const isBadScheme = (url) => BAD_SCHEMES.some(s => url.toLowerCase().startsWith(s));

self.addEventListener('install', () => {
  console.log('[SW AdBlock] Installé');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW AdBlock] Actif');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. Bloquer les schémas d'app mobile
  if (isBadScheme(url)) {
    console.log('[SW AdBlock] Schéma app bloqué:', url.substring(0, 60));
    event.respondWith(new Response('', { status: 204 }));
    return;
  }

  // 2. Toujours laisser passer les ressources autorisées
  if (isAlwaysAllowed(url)) {
    return; // fetch normal
  }

  // 3. Bloquer les navigations (changements de page) vers l'extérieur
  if (event.request.mode === 'navigate') {
    if (!url.startsWith(OWN_ORIGIN)) {
      console.log('[SW AdBlock] Navigation externe bloquée:', url.substring(0, 80));
      event.respondWith(
        fetch('/index.html').catch(() => new Response('<script>history.back()</script>', {
          headers: { 'Content-Type': 'text/html' }
        }))
      );
      return;
    }
  }

  // 4. Bloquer les requêtes vers des domaines pub (scripts, images, iframes pub)
  if (event.request.mode !== 'navigate' && isDomainBlocked(url)) {
    console.log('[SW AdBlock] Requête pub bloquée:', url.substring(0, 80));
    // Retourner une réponse vide transparente (comme uBlock)
    event.respondWith(new Response('', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    }));
    return;
  }

  // 5. Tout le reste : laisser passer normalement
});
