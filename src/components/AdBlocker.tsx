import { useEffect } from 'react';

const OWN_ORIGIN = window.location.origin;

// Schémas d'app mobile — bloquer immédiatement
const BAD_SCHEMES = [
  'intent://','market://','fb://','twitter://','whatsapp://',
  'tel://','sms://','android-app://','ios-app://','app://',
  'capacitor://','mms://','viber://','tg://','snapchat://',
  'instagram://','youtube://','mailto://','itms-apps://',
  'itms://','maps://','geo:','callto://',
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

    // ══════════════════════════════════════════════════════════
    // COUCHE 1 — window.open : ZÉRO exception, ZÉRO nouvel onglet
    // C'est la porte principale par laquelle la "page intermédiaire" s'ouvre
    // ══════════════════════════════════════════════════════════
    const origOpen = window.open;
    window.open = () => null;

    // ══════════════════════════════════════════════════════════
    // COUCHE 2 — Bloquer les liens <a target="_blank"> et tout lien externe
    // ══════════════════════════════════════════════════════════
    const blockLink = (e: Event) => {
      const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.href || '';
      // Bloquer si : lien externe OU _blank OU schéma d'app
      if (isExternal(href) || a.target === '_blank' || a.target === '_new' || isBadScheme(href)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener('click',      blockLink, { capture: true });
    document.addEventListener('touchstart', blockLink, { capture: true, passive: false } as any);
    document.addEventListener('touchend',   blockLink, { capture: true, passive: false } as any);

    // ══════════════════════════════════════════════════════════
    // COUCHE 3 — Intercepter location.assign / location.replace / location.href
    // Les scripts de pub appellent directement ces méthodes
    // ══════════════════════════════════════════════════════════
    const origAssign  = location.assign.bind(location);
    const origReplace = location.replace.bind(location);

    location.assign = (url: string) => {
      if (isExternal(url)) { console.log('[AB] location.assign bloqué'); return; }
      origAssign(url);
    };
    location.replace = (url: string) => {
      if (isExternal(url)) { console.log('[AB] location.replace bloqué'); return; }
      origReplace(url);
    };

    // Proxy sur window.location.href (écriture)
    try {
      const locDesc = Object.getOwnPropertyDescriptor(window.Location.prototype, 'href');
      if (locDesc?.set) {
        Object.defineProperty(window.Location.prototype, 'href', {
          ...locDesc,
          set(url: string) {
            if (isExternal(url)) { console.log('[AB] location.href= bloqué'); return; }
            locDesc.set!.call(this, url);
          },
        });
      }
    } catch (_) {}

    // ══════════════════════════════════════════════════════════
    // COUCHE 4 — history.pushState / replaceState
    // ══════════════════════════════════════════════════════════
    const origPush    = history.pushState.bind(history);
    const origHReplace = history.replaceState.bind(history);
    history.pushState = (s, t, url?: string | URL | null) => {
      if (url && isExternal(url.toString())) return;
      origPush(s, t, url);
    };
    history.replaceState = (s, t, url?: string | URL | null) => {
      if (url && isExternal(url.toString())) return;
      origHReplace(s, t, url);
    };

    // ══════════════════════════════════════════════════════════
    // COUCHE 5 — beforeunload : empêche toute sortie de page
    // ══════════════════════════════════════════════════════════
    const blockUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', blockUnload, true);

    // ══════════════════════════════════════════════════════════
    // COUCHE 6 — createElement('a') + .click() programmatique
    // ══════════════════════════════════════════════════════════
    const origCreate = document.createElement.bind(document);
    (document as any).createElement = (tag: string, ...args: any[]) => {
      const el = origCreate(tag, ...args);
      if (tag.toLowerCase() === 'a') {
        const origClick = el.click.bind(el);
        (el as any).click = () => {
          const a = el as HTMLAnchorElement;
          if (isExternal(a.href) || a.target === '_blank') return;
          origClick();
        };
      }
      return el;
    };

    // ══════════════════════════════════════════════════════════
    // COUCHE 7 — MutationObserver : supprimer iframes/overlays pub
    // ══════════════════════════════════════════════════════════
    const AD_HOSTS = [
      'doubleclick','googlesyndication','adnxs','rubiconproject',
      'pubmatic','openx','criteo','taboola','outbrain','exoclick',
      'propellerads','trafficjunky','popcash','popads','adcash',
      'realsrv','adtng','clickadu','hilltopads','adsterra',
    ];
    const isAdSrc = (src: string) => {
      try {
        const h = new URL(src).hostname;
        return AD_HOSTS.some(d => h.includes(d));
      } catch { return false; }
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;

          // Iframes pub
          if (node instanceof HTMLIFrameElement && isAdSrc(node.src)) {
            node.remove(); continue;
          }
          node.querySelectorAll?.('iframe').forEach(f => {
            if (isAdSrc((f as HTMLIFrameElement).src)) f.remove();
          });

          // Scripts pub
          if (node instanceof HTMLScriptElement && isAdSrc(node.src)) {
            node.remove(); continue;
          }

          // Overlays / popups injectés (z-index > 999, grande taille, hors notre UI)
          if (node.closest('[data-radix-portal]') || node.closest('[role="dialog"]')) continue;
          const cs = window.getComputedStyle(node);
          const zi = parseInt(cs.zIndex || '0', 10);
          if ((cs.position === 'fixed' || cs.position === 'absolute') && zi > 999) {
            const r = node.getBoundingClientRect();
            if (r.width > window.innerWidth * 0.2 && r.height > window.innerHeight * 0.2) {
              node.remove();
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ══════════════════════════════════════════════════════════
    // COUCHE 8 — postMessage entre iframes
    // ══════════════════════════════════════════════════════════
    const BAD_MSG = ['popup','popunder','ad_click','openurl','open_url',
                     'newwindow','click_url','adurl','navigate_to','redirect'];
    const handleMsg = (e: MessageEvent) => {
      try {
        const c = (typeof e.data === 'string' ? e.data : JSON.stringify(e.data ?? '')).toLowerCase();
        if (BAD_MSG.some(k => c.includes(k))) e.stopImmediatePropagation();
      } catch (_) {}
    };
    window.addEventListener('message', handleMsg, true);

    // ══════════════════════════════════════════════════════════
    // COUCHE 9 — Blur trick (mobile : page perd focus = app ouverte)
    // ══════════════════════════════════════════════════════════
    const refocus = () => setTimeout(() => window.focus(), 50);
    window.addEventListener('blur', refocus, true);

    // ══════════════════════════════════════════════════════════
    // COUCHE 10 — Garde URL (filet de sécurité, intervalle 100ms)
    // Si malgré tout la navigation a lieu, on revient immédiatement
    // ══════════════════════════════════════════════════════════
    let lastHref = window.location.href;
    const guard = setInterval(() => {
      const cur = window.location.href;
      if (cur !== lastHref) {
        if (isExternal(cur)) { history.back(); }
        else { lastHref = cur; }
      }
    }, 100);

    return () => {
      window.open = origOpen;
      (document as any).createElement = origCreate;
      history.pushState    = origPush;
      history.replaceState = origHReplace;
      try { location.assign  = origAssign;  } catch (_) {}
      try { location.replace = origReplace; } catch (_) {}
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
