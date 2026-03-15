import { useEffect } from 'react';

// ============================================================
// DNS / domaines publicitaires bloqués (liste étendue)
// ============================================================
const BLOCKED_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adservice.google.com', 'pagead2.googlesyndication.com',
  'adnxs.com', 'rubiconproject.com', 'pubmatic.com', 'openx.net',
  'casalemedia.com', 'criteo.com', 'adsrvr.org', 'moatads.com',
  'advertising.com', 'adbrite.com', 'adform.net', 'adroll.com',
  'outbrain.com', 'taboola.com', 'revcontent.com', 'mgid.com',
  'sharethrough.com', 'triplelift.com', 'sovrn.com', 'contextweb.com',
  'smartadserver.com', 'appnexus.com', 'indexexchange.com',
  'lkqd.net', 'spotxchange.com', 'springserve.com', 'teads.tv',
  'yieldmo.com', '33across.com', 'rhythmone.com', 'undertone.com',
  'conversantmedia.com', 'dotomi.com', 'bidswitch.net', 'lijit.com',
  'media.net', 'adsymptotic.com', 'adtrue.com', 'cdn.adnxs.com',
  'scorecardresearch.com', 'quantserve.com', 'bluekai.com',
  'exelator.com', 'turn.com', 'eyeota.net',
  'clickadu.com', 'popcash.net', 'popads.net', 'adcash.com',
  'propellerads.com', 'hilltopads.net', 'trafficjunky.net',
  'exoclick.com', 'juicyads.com', 'trafficforce.com', 'plugrush.com',
  'adspyglass.com', 'adxpansion.com', 'ero-advertising.com',
  'tsyndicate.com', 'traffic-media.co', 'trafficshop.com',
  'adcolony.com', 'applovin.com', 'vungle.com', 'mocopay.net',
  'realsrv.com', 'tmia.com', 'adtng.com',
];

const BLOCKED_URL_PATTERNS = [
  /\/ads?\//i, /\/banner/i, /\/popup/i, /\/popunder/i,
  /\/redirect/i, /\/clickthrough/i, /\/affiliate/i,
  /adclick/i, /adserv/i, /adtech/i, /adnetwork/i,
  /tracking/i, /go\.php\?/i, /out\.php\?/i, /click\.php\?/i,
];

const isDomainBlocked = (url: string): boolean => {
  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(d => hostname.includes(d.toLowerCase())) ||
           BLOCKED_URL_PATTERNS.some(p => p.test(url));
  } catch {
    return BLOCKED_URL_PATTERNS.some(p => p.test(url));
  }
};

const AdBlocker: React.FC = () => {
  useEffect(() => {
    // 1. Bloquer TOUT window.open — aucune exception
    const originalOpen = window.open;
    window.open = function() {
      console.log('[AdBlocker] window.open bloqué');
      return null;
    };

    // 2. Bloquer history navigation vers domaines pub
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);
    history.pushState = function(state, title, url?: string | URL | null) {
      if (url && isDomainBlocked(url.toString())) { console.log('[AdBlocker] pushState bloqué'); return; }
      return originalPushState(state, title, url);
    };
    history.replaceState = function(state, title, url?: string | URL | null) {
      if (url && isDomainBlocked(url.toString())) { console.log('[AdBlocker] replaceState bloqué'); return; }
      return originalReplaceState(state, title, url);
    };

    // 3. Bloquer beforeunload (empêche sortie de page)
    const blockUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', blockUnload, true);

    // 4. Bloquer les clics sur liens externes publicitaires (PC)
    const blockExternalClicks = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
      if (anchor?.href && isDomainBlocked(anchor.href)) {
        e.preventDefault(); e.stopImmediatePropagation();
        console.log('[AdBlocker] Clic pub bloqué:', anchor.href);
      }
    };
    document.addEventListener('click', blockExternalClicks, true);

    // 5. Bloquer les touches mobiles sur liens pub
    const blockTouchOnAds = (e: TouchEvent) => {
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
      if (anchor?.href && isDomainBlocked(anchor.href)) {
        e.preventDefault(); e.stopImmediatePropagation();
        console.log('[AdBlocker] Touch pub bloqué');
      }
    };
    document.addEventListener('touchstart', blockTouchOnAds, { capture: true, passive: false });

    // 6. MutationObserver — supprimer iframes/scripts/overlays pub injectés
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          // Iframes pub
          if (node instanceof HTMLIFrameElement && isDomainBlocked(node.src || '')) {
            node.remove(); console.log('[AdBlocker] iframe pub supprimée'); return;
          }
          node.querySelectorAll?.('iframe').forEach((iframe) => {
            if (isDomainBlocked(iframe.src || '')) { iframe.remove(); }
          });

          // Scripts pub
          if (node instanceof HTMLScriptElement && isDomainBlocked(node.src || '')) {
            node.remove(); console.log('[AdBlocker] script pub supprimé'); return;
          }

          // Overlays/popups (fixed/absolute avec z-index > 1000 et grande taille)
          const style = window.getComputedStyle(node);
          const zIndex = parseInt(style.zIndex || '0', 10);
          if ((style.position === 'fixed' || style.position === 'absolute') && zIndex > 1000) {
            const rect = node.getBoundingClientRect();
            const isBigOverlay = rect.width > window.innerWidth * 0.3 && rect.height > window.innerHeight * 0.3;
            const isOurUI = node.closest('[data-radix-portal]') || node.closest('[data-radix-dialog-content]');
            if (isBigOverlay && !isOurUI) {
              node.remove(); console.log('[AdBlocker] overlay pub supprimé');
            }
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 7. Bloquer postMessage malveillants des iframes
    const AD_MESSAGE_KEYWORDS = ['popup', 'popunder', 'redirect', 'ad_click', 'openurl',
      'open_url', 'navigate_to', 'newwindow', 'click_url', 'clickurl', 'adurl'];
    const handleMessage = (event: MessageEvent) => {
      try {
        const content = typeof event.data === 'string'
          ? event.data.toLowerCase()
          : JSON.stringify(event.data || '').toLowerCase();
        if (AD_MESSAGE_KEYWORDS.some(k => content.includes(k))) {
          event.stopImmediatePropagation();
          console.log('[AdBlocker] postMessage pub bloqué');
        }
      } catch (_) {}
    };
    window.addEventListener('message', handleMessage, true);

    // (sandbox retiré volontairement pour compatibilité lecteurs)

    // 9. Empêcher le blur/focus trick utilisé par les pubs mobiles
    const refocusPage = () => setTimeout(() => window.focus(), 0);
    window.addEventListener('blur', refocusPage, true);

    return () => {
      window.open = originalOpen;
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('beforeunload', blockUnload, true);
      document.removeEventListener('click', blockExternalClicks, true);
      document.removeEventListener('touchstart', blockTouchOnAds, true);
      window.removeEventListener('message', handleMessage, true);
      window.removeEventListener('blur', refocusPage, true);
      observer.disconnect();
    };
  }, []);

  return null;
};

export default AdBlocker;
