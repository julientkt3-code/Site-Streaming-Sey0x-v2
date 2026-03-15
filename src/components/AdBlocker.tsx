import { useEffect } from 'react';

// ─────────────────────────────────────────────────────────────
// Liste DNS — domaines publicitaires bloqués
// ─────────────────────────────────────────────────────────────
const BLOCKED_DOMAINS = [
  'doubleclick.net','googlesyndication.com','googleadservices.com',
  'adservice.google.com','pagead2.googlesyndication.com',
  'adnxs.com','rubiconproject.com','pubmatic.com','openx.net',
  'casalemedia.com','criteo.com','adsrvr.org','moatads.com',
  'advertising.com','adbrite.com','adform.net','adroll.com',
  'outbrain.com','taboola.com','revcontent.com','mgid.com',
  'sharethrough.com','triplelift.com','sovrn.com','contextweb.com',
  'smartadserver.com','appnexus.com','indexexchange.com',
  'lkqd.net','spotxchange.com','springserve.com','teads.tv',
  'yieldmo.com','33across.com','rhythmone.com','undertone.com',
  'conversantmedia.com','dotomi.com','bidswitch.net','lijit.com',
  'media.net','adsymptotic.com','adtrue.com','cdn.adnxs.com',
  'scorecardresearch.com','quantserve.com','bluekai.com',
  'exelator.com','turn.com','eyeota.net',
  'clickadu.com','popcash.net','popads.net','adcash.com',
  'propellerads.com','hilltopads.net','trafficjunky.net',
  'exoclick.com','juicyads.com','trafficforce.com','plugrush.com',
  'adspyglass.com','adxpansion.com','ero-advertising.com',
  'tsyndicate.com','traffic-media.co','trafficshop.com',
  'adcolony.com','applovin.com','vungle.com','mocopay.net',
  'realsrv.com','tmia.com','adtng.com','moonads.com',
  'bidvertiser.com','adsterra.com','admaven.com','onevideo.aol.com',
  'popunder.net','pop-ads.net','advert-media.ru',
];

const BLOCKED_PATTERNS = [
  /\/ads?\//i,/\/banner/i,/\/popup/i,/\/popunder/i,
  /\/redirect/i,/\/clickthrough/i,/adclick/i,/adserv/i,
  /go\.php\?/i,/out\.php\?/i,/click\.php\?/i,
];

// URL de notre propre site (pour ne jamais bloquer nos propres routes)
const OWN_ORIGIN = window.location.origin;

const isAdUrl = (url: string): boolean => {
  if (!url || url.startsWith(OWN_ORIGIN) || url.startsWith('/') || url.startsWith('#')) return false;
  try {
    const u = new URL(url, OWN_ORIGIN);
    if (u.origin === OWN_ORIGIN) return false;
    const h = u.hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(d => h.includes(d)) || BLOCKED_PATTERNS.some(p => p.test(url));
  } catch {
    return BLOCKED_PATTERNS.some(p => p.test(url));
  }
};

// Vrai domaine externe (pas les nôtres, pas des data:, blob:, javascript:)
const isExternalNavigation = (url: string): boolean => {
  if (!url) return false;
  if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('blob:')) return true;
  if (url.startsWith('/') || url.startsWith('#') || url.startsWith(OWN_ORIGIN)) return false;
  try {
    const u = new URL(url, OWN_ORIGIN);
    return u.origin !== OWN_ORIGIN;
  } catch { return false; }
};

const AdBlocker: React.FC = () => {
  useEffect(() => {
    // ── 1. window.open — bloqué à 100% ────────────────────────
    const originalOpen = window.open;
    window.open = function() {
      console.log('[AdBlocker] window.open bloqué');
      return null;
    };

    // ── 2. Intercepter createElement('a') + click() programmatique ──
    // Technique utilisée par les pubs pour simuler un clic sur un lien
    const originalCreateElement = document.createElement.bind(document);
    (document as any).createElement = function(tag: string, ...args: any[]) {
      const el = originalCreateElement(tag, ...args);
      if (tag.toLowerCase() === 'a') {
        const originalClick = el.click.bind(el);
        (el as any).click = function() {
          const href = (el as HTMLAnchorElement).href;
          if (isExternalNavigation(href)) {
            console.log('[AdBlocker] createElement click externe bloqué:', href);
            return;
          }
          return originalClick();
        };
      }
      return el;
    };

    // ── 3. Proxy sur window.location pour bloquer tout changement d'URL externe ──
    // Les iframes ne peuvent pas accéder directement à window.location du parent
    // mais on bloque aussi via beforeunload + pushState
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);
    history.pushState = function(state: any, title: string, url?: string | URL | null) {
      if (url && isAdUrl(url.toString())) { console.log('[AdBlocker] pushState ad bloqué'); return; }
      return originalPushState(state, title, url);
    };
    history.replaceState = function(state: any, title: string, url?: string | URL | null) {
      if (url && isAdUrl(url.toString())) { console.log('[AdBlocker] replaceState ad bloqué'); return; }
      return originalReplaceState(state, title, url);
    };

    // ── 4. beforeunload — empêche toute sortie de page ────────
    const blockUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', blockUnload, true);

    // ── 5. Intercepter TOUS les clics — bloquer si externe (PC) ─
    const blockClicks = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.href || '';
      // Bloquer ouverture externe (_blank vers site externe)
      if (isExternalNavigation(href) && (anchor.target === '_blank' || isAdUrl(href))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log('[AdBlocker] clic externe bloqué:', href.substring(0, 80));
      }
    };
    document.addEventListener('click', blockClicks, true);

    // ── 6. Même chose sur mobile (touchend) ────────────────────
    const blockTouch = (e: TouchEvent) => {
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.href || '';
      if (isExternalNavigation(href) && (anchor.target === '_blank' || isAdUrl(href))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log('[AdBlocker] touch externe bloqué');
      }
    };
    document.addEventListener('touchend', blockTouch, { capture: true, passive: false });

    // ── 7. MutationObserver — nettoyer les nœuds pub injectés ──
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;

          // Supprimer iframes pub
          if (node instanceof HTMLIFrameElement && isAdUrl(node.src)) {
            node.remove(); continue;
          }
          node.querySelectorAll?.('iframe').forEach(f => {
            if (isAdUrl((f as HTMLIFrameElement).src)) f.remove();
          });

          // Supprimer scripts pub
          if (node instanceof HTMLScriptElement && isAdUrl(node.src)) {
            node.remove(); continue;
          }

          // Supprimer overlays pub (fixed/absolute, z > 999, grande surface)
          // en excluant rigoureusement notre propre UI Radix
          if (node.id?.includes('radix') || node.getAttribute('data-radix-portal') !== null) continue;
          if (node.closest('[data-radix-portal]') || node.closest('[role="dialog"]')) continue;

          const cs = window.getComputedStyle(node);
          const zi = parseInt(cs.zIndex || '0', 10);
          if ((cs.position === 'fixed' || cs.position === 'absolute') && zi > 999) {
            const r = node.getBoundingClientRect();
            const isBig = r.width > window.innerWidth * 0.25 && r.height > window.innerHeight * 0.25;
            if (isBig) {
              node.remove();
              console.log('[AdBlocker] overlay pub supprimé (z=' + zi + ')');
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ── 8. postMessage — bloquer messages de navigation des iframes ──
    const AD_MSG = ['popup','popunder','ad_click','openurl','open_url',
                    'newwindow','click_url','clickurl','adurl','navigate_to'];
    const handleMessage = (e: MessageEvent) => {
      try {
        const raw = typeof e.data === 'string' ? e.data : JSON.stringify(e.data ?? '');
        const content = raw.toLowerCase();
        if (AD_MSG.some(k => content.includes(k))) {
          e.stopImmediatePropagation();
          console.log('[AdBlocker] postMessage ad bloqué');
        }
      } catch (_) {}
    };
    window.addEventListener('message', handleMessage, true);

    // ── 9. Bloquer le blur trick (pub mobile qui s'ouvre quand focus perdu) ──
    const refocus = () => setTimeout(() => window.focus(), 50);
    window.addEventListener('blur', refocus, true);

    // ── 10. Surveiller window.location.href (défense en profondeur) ──
    // Si quelque chose essaie de changer location.href vers un domaine externe
    let lastHref = window.location.href;
    const locationGuard = setInterval(() => {
      const current = window.location.href;
      if (current !== lastHref) {
        if (isExternalNavigation(current) && !current.startsWith(OWN_ORIGIN)) {
          console.log('[AdBlocker] navigation externe détectée, retour arrière');
          history.back();
        } else {
          lastHref = current;
        }
      }
    }, 100);

    return () => {
      window.open = originalOpen;
      (document as any).createElement = originalCreateElement;
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('beforeunload', blockUnload, true);
      document.removeEventListener('click', blockClicks, true);
      document.removeEventListener('touchend', blockTouch, true);
      window.removeEventListener('message', handleMessage, true);
      window.removeEventListener('blur', refocus, true);
      observer.disconnect();
      clearInterval(locationGuard);
    };
  }, []);

  return null;
};

export default AdBlocker;
