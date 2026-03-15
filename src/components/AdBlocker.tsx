import React, { useEffect } from 'react';

// Ce composant complète le script inline de index.html
// Il gère ce qui ne peut être fait qu'après le montage de React :
// - Suppression des overlays/iframes pub injectés dynamiquement
// - postMessage
// - Garde URL

const AD_HOSTS = [
  'doubleclick','googlesyndication','adnxs','rubiconproject','pubmatic',
  'openx','criteo','taboola','outbrain','exoclick','propellerads',
  'trafficjunky','popcash','popads','adcash','realsrv','adtng',
  'clickadu','hilltopads','adsterra','admaven','bidvertiser',
  'mgid','outbrain','revcontent','taboola',
];

const isAdSrc = (src: string) => {
  try { const h = new URL(src).hostname; return AD_HOSTS.some(d => h.includes(d)); }
  catch { return false; }
};

const AdBlocker: React.FC = () => {
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    // Observer — supprimer les éléments pub injectés dynamiquement
    try {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of Array.from(m.addedNodes)) {
            if (!(node instanceof HTMLElement)) continue;
            // Iframes pub
            if (node instanceof HTMLIFrameElement && isAdSrc(node.src)) { node.remove(); continue; }
            node.querySelectorAll?.('iframe').forEach(f => {
              if (isAdSrc((f as HTMLIFrameElement).src)) f.remove();
            });
            // Scripts pub
            if (node instanceof HTMLScriptElement && isAdSrc(node.src)) { node.remove(); continue; }
            // Overlays plein écran (z > 999, hors notre UI)
            if (node.closest?.('[data-radix-portal]') || node.closest?.('[role="dialog"]')) continue;
            try {
              const cs = window.getComputedStyle(node);
              const zi = parseInt(cs.zIndex || '0', 10);
              if ((cs.position === 'fixed' || cs.position === 'absolute') && zi > 999) {
                const r = node.getBoundingClientRect();
                if (r.width > window.innerWidth * 0.2 && r.height > window.innerHeight * 0.2) {
                  node.remove();
                }
              }
            } catch (_) {}
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      cleanups.push(() => observer.disconnect());
    } catch (_) {}

    // postMessage
    try {
      const BAD_MSG = ['popup','popunder','ad_click','openurl','open_url','newwindow','click_url','adurl'];
      const handleMsg = (e: MessageEvent) => {
        try {
          const c = (typeof e.data === 'string' ? e.data : JSON.stringify(e.data ?? '')).toLowerCase();
          if (BAD_MSG.some(k => c.includes(k))) e.stopImmediatePropagation();
        } catch (_) {}
      };
      window.addEventListener('message', handleMsg, true);
      cleanups.push(() => window.removeEventListener('message', handleMsg, true));
    } catch (_) {}

    // Garde URL — filet de sécurité final
    try {
      const own = window.location.origin;
      let last = window.location.href;
      const guard = setInterval(() => {
        try {
          const cur = window.location.href;
          if (cur !== last) {
            try {
              if (new URL(cur).origin !== own) history.back();
              else last = cur;
            } catch { history.back(); }
          }
        } catch (_) {}
      }, 200);
      cleanups.push(() => clearInterval(guard));
    } catch (_) {}

    return () => cleanups.forEach(fn => { try { fn(); } catch (_) {} });
  }, []);

  return null;
};

export default AdBlocker;
