import React, { useEffect } from 'react';

const OWN_ORIGIN = (() => { try { return window.location.origin; } catch { return ''; } })();

const BAD_SCHEMES = [
  'intent://','market://','android-app://','ios-app://','itms-apps://',
  'itms://','fb://','twitter://','whatsapp://','viber://','tg://',
  'snapchat://','instagram://','youtube://','callto://','geo:',
];

const isBadScheme = (url: string) =>
  BAD_SCHEMES.some(s => url.toLowerCase().startsWith(s));

const isExternal = (url: string): boolean => {
  if (!url) return false;
  try {
    if (isBadScheme(url)) return true;
    if (url.startsWith('javascript:') || url.startsWith('data:')) return true;
    if (url.startsWith('/') || url.startsWith('#') || url.startsWith(OWN_ORIGIN)) return false;
    return new URL(url, OWN_ORIGIN).origin !== OWN_ORIGIN;
  } catch { return true; }
};

const AD_HOSTS = [
  'doubleclick','googlesyndication','adnxs','rubiconproject','pubmatic',
  'openx','criteo','taboola','outbrain','exoclick','propellerads',
  'trafficjunky','popcash','popads','adcash','realsrv','adtng',
  'clickadu','hilltopads','adsterra','admaven','bidvertiser',
];
const isAdSrc = (src: string) => {
  try { const h = new URL(src).hostname; return AD_HOSTS.some(d => h.includes(d)); }
  catch { return false; }
};

const AdBlocker: React.FC = () => {
  useEffect(() => {
    // Tout dans un gros try/catch — si quelque chose crash, ça ne tue pas React
    const cleanups: (() => void)[] = [];

    try {
      // 1. window.open
      const origOpen = window.open;
      window.open = () => null;
      cleanups.push(() => { window.open = origOpen; });
    } catch (_) {}

    try {
      // 2. Bloquer liens <a> externes — UNIQUEMENT les <a>, pas les taps sur iframe
      const blockLink = (e: Event) => {
        try {
          const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
          if (!a) return;
          const href = a.href || '';
          if (isExternal(href) || a.target === '_blank' || a.target === '_new') {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        } catch (_) {}
      };
      document.addEventListener('click', blockLink, true);
      document.addEventListener('touchstart', blockLink, { capture: true, passive: false } as any);
      cleanups.push(() => {
        document.removeEventListener('click', blockLink, true);
        document.removeEventListener('touchstart', blockLink, true);
      });
    } catch (_) {}

    try {
      // 3. history push/replace
      const origPush     = history.pushState.bind(history);
      const origReplace  = history.replaceState.bind(history);
      history.pushState    = (s, t, url?: string | URL | null) => { if (!url || !isExternal(url.toString())) origPush(s, t, url); };
      history.replaceState = (s, t, url?: string | URL | null) => { if (!url || !isExternal(url.toString())) origReplace(s, t, url); };
      cleanups.push(() => { history.pushState = origPush; history.replaceState = origReplace; });
    } catch (_) {}

    try {
      // 4. beforeunload
      const blockUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
      window.addEventListener('beforeunload', blockUnload, true);
      cleanups.push(() => window.removeEventListener('beforeunload', blockUnload, true));
    } catch (_) {}

    try {
      // 5. createElement('a') programmatique
      const origCreate = document.createElement.bind(document);
      (document as any).createElement = (tag: string, ...args: any[]) => {
        const el = origCreate(tag, ...args);
        if (tag.toLowerCase() === 'a') {
          const origClick = el.click.bind(el);
          (el as any).click = () => {
            const a = el as HTMLAnchorElement;
            if (!isExternal(a.href) && a.target !== '_blank') origClick();
          };
        }
        return el;
      };
      cleanups.push(() => { (document as any).createElement = origCreate; });
    } catch (_) {}

    try {
      // 6. MutationObserver — supprimer iframes/overlays pub injectés
      const observer = new MutationObserver((mutations) => {
        try {
          for (const m of mutations) {
            for (const node of Array.from(m.addedNodes)) {
              if (!(node instanceof HTMLElement)) continue;
              if (node instanceof HTMLIFrameElement && isAdSrc(node.src)) { node.remove(); continue; }
              node.querySelectorAll?.('iframe').forEach(f => { if (isAdSrc((f as HTMLIFrameElement).src)) f.remove(); });
              if (node instanceof HTMLScriptElement && isAdSrc(node.src)) { node.remove(); continue; }
              if (node.closest?.('[data-radix-portal]') || node.closest?.('[role="dialog"]')) continue;
              try {
                const cs = window.getComputedStyle(node);
                const zi = parseInt(cs.zIndex || '0', 10);
                if ((cs.position === 'fixed' || cs.position === 'absolute') && zi > 999) {
                  const r = node.getBoundingClientRect();
                  if (r.width > window.innerWidth * 0.2 && r.height > window.innerHeight * 0.2) node.remove();
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      });
      observer.observe(document.body, { childList: true, subtree: true });
      cleanups.push(() => observer.disconnect());
    } catch (_) {}

    try {
      // 7. postMessage
      const BAD_MSG = ['popup','popunder','ad_click','openurl','open_url','newwindow','click_url','adurl','navigate_to'];
      const handleMsg = (e: MessageEvent) => {
        try {
          const c = (typeof e.data === 'string' ? e.data : JSON.stringify(e.data ?? '')).toLowerCase();
          if (BAD_MSG.some(k => c.includes(k))) e.stopImmediatePropagation();
        } catch (_) {}
      };
      window.addEventListener('message', handleMsg, true);
      cleanups.push(() => window.removeEventListener('message', handleMsg, true));
    } catch (_) {}

    try {
      // 8. Blur trick
      const refocus = () => { try { setTimeout(() => window.focus(), 50); } catch (_) {} };
      window.addEventListener('blur', refocus, true);
      cleanups.push(() => window.removeEventListener('blur', refocus, true));
    } catch (_) {}

    try {
      // 9. Garde URL — filet de sécurité
      let lastHref = window.location.href;
      const guard = setInterval(() => {
        try {
          const cur = window.location.href;
          if (cur !== lastHref) {
            if (isExternal(cur)) history.back();
            else lastHref = cur;
          }
        } catch (_) {}
      }, 200);
      cleanups.push(() => clearInterval(guard));
    } catch (_) {}

    return () => { cleanups.forEach(fn => { try { fn(); } catch (_) {} }); };
  }, []);

  return null;
};

export default AdBlocker;
