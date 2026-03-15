import { useEffect } from 'react';

const OWN_ORIGIN = window.location.origin;

const BAD_SCHEMES = [
  'intent://','market://','android-app://','ios-app://','itms-apps://',
  'itms://','fb://','twitter://','whatsapp://','viber://','tg://',
  'snapchat://','instagram://','youtube://','callto://','geo:',
];

const isBadScheme = (url: string) =>
  BAD_SCHEMES.some(s => url.toLowerCase().startsWith(s));

const isExternal = (url: string): boolean => {
  if (!url) return false;
  if (isBadScheme(url)) return true;
  if (url.startsWith('javascript:') || url.startsWith('data:')) return true;
  if (url.startsWith('/') || url.startsWith('#') || url.startsWith(OWN_ORIGIN)) return false;
  try { return new URL(url, OWN_ORIGIN).origin !== OWN_ORIGIN; }
  catch { return true; }
};

const AdBlocker: React.FC = () => {
  useEffect(() => {

    // 1. window.open — bloqué totalement
    const origOpen = window.open;
    window.open = () => null;

    // 2. Liens <a> externes / _blank — bloqués sur click ET touch
    //    IMPORTANT : on ne bloque QUE les liens <a>, pas les taps sur l'iframe elle-même
    const blockLink = (e: Event) => {
      const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
      if (!a) return; // pas un lien → laisser passer (ne pas gêner le lecteur)
      const href = a.href || '';
      if (isExternal(href) || a.target === '_blank' || a.target === '_new' || isBadScheme(href)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener('click',      blockLink, { capture: true });
    document.addEventListener('touchstart', blockLink, { capture: true, passive: false } as any);
    document.addEventListener('touchend',   blockLink, { capture: true, passive: false } as any);

    // 3. location.assign / location.replace
    const origAssign  = location.assign.bind(location);
    const origReplace = location.replace.bind(location);
    location.assign  = (url: string) => { if (!isExternal(url)) origAssign(url);  };
    location.replace = (url: string) => { if (!isExternal(url)) origReplace(url); };

    // 4. window.Location.prototype.href (écriture directe)
    try {
      const desc = Object.getOwnPropertyDescriptor(window.Location.prototype, 'href');
      if (desc?.set) {
        Object.defineProperty(window.Location.prototype, 'href', {
          ...desc,
          set(url: string) {
            if (isExternal(url)) return;
            desc.set!.call(this, url);
          },
        });
      }
    } catch (_) {}

    // 5. history push/replace
    const origPush     = history.pushState.bind(history);
    const origHReplace = history.replaceState.bind(history);
    history.pushState    = (s, t, url?: string | URL | null) => { if (!url || !isExternal(url.toString())) origPush(s, t, url); };
    history.replaceState = (s, t, url?: string | URL | null) => { if (!url || !isExternal(url.toString())) origHReplace(s, t, url); };

    // 6. beforeunload
    const blockUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', blockUnload, true);

    // 7. createElement('a') programmatique
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

    // 8. MutationObserver — supprimer iframes/overlays pub injectés
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

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (node instanceof HTMLIFrameElement && isAdSrc(node.src)) { node.remove(); continue; }
          node.querySelectorAll?.('iframe').forEach(f => { if (isAdSrc((f as HTMLIFrameElement).src)) f.remove(); });
          if (node instanceof HTMLScriptElement && isAdSrc(node.src)) { node.remove(); continue; }
          if (node.closest('[data-radix-portal]') || node.closest('[role="dialog"]')) continue;
          const cs = window.getComputedStyle(node);
          const zi = parseInt(cs.zIndex || '0', 10);
          if ((cs.position === 'fixed' || cs.position === 'absolute') && zi > 999) {
            const r = node.getBoundingClientRect();
            if (r.width > window.innerWidth * 0.2 && r.height > window.innerHeight * 0.2) node.remove();
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 9. postMessage
    const BAD_MSG = ['popup','popunder','ad_click','openurl','open_url','newwindow','click_url','adurl','navigate_to','redirect'];
    const handleMsg = (e: MessageEvent) => {
      try {
        const c = (typeof e.data === 'string' ? e.data : JSON.stringify(e.data ?? '')).toLowerCase();
        if (BAD_MSG.some(k => c.includes(k))) e.stopImmediatePropagation();
      } catch (_) {}
    };
    window.addEventListener('message', handleMsg, true);

    // 10. Blur trick
    const refocus = () => setTimeout(() => window.focus(), 50);
    window.addEventListener('blur', refocus, true);

    // 11. Garde URL — filet de sécurité
    let lastHref = window.location.href;
    const guard = setInterval(() => {
      const cur = window.location.href;
      if (cur !== lastHref) {
        if (isExternal(cur)) history.back();
        else lastHref = cur;
      }
    }, 100);

    return () => {
      window.open = origOpen;
      (document as any).createElement = origCreate;
      history.pushState    = origPush;
      history.replaceState = origHReplace;
      try { location.assign = origAssign; location.replace = origReplace; } catch (_) {}
      window.removeEventListener('beforeunload', blockUnload, true);
      document.removeEventListener('click',      blockLink, true);
      document.removeEventListener('touchstart', blockLink, true);
      document.removeEventListener('touchend',   blockLink, true);
      window.removeEventListener('message', handleMsg, true);
      window.removeEventListener('blur',    refocus,  true);
      observer.disconnect();
      clearInterval(guard);
    };
  }, []);

  return null;
};

export default AdBlocker;
