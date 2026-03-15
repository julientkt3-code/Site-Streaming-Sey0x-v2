import { useEffect } from 'react';

/**
 * AdBlocker — bloque les popups, redirections et nouvelles fenêtres
 * déclenchées par les iframes de streaming (vidsrc, embed.su, etc.)
 */
const AdBlocker: React.FC = () => {
  useEffect(() => {
    // 1. Bloquer window.open (méthode la plus courante pour les pubs)
    const originalOpen = window.open;
    window.open = function(url?: string | URL, target?: string, ...args: any[]) {
      // Autoriser uniquement les ouvertures depuis notre propre code (sans url = popup bloqué)
      if (!url) return null;
      const urlStr = url.toString();
      // Bloquer les URLs suspectes de pub
      const adPatterns = [
        /doubleclick\.net/i,
        /googlesyndication/i,
        /adservice/i,
        /pagead/i,
        /popup/i,
        /popunder/i,
        /redirect/i,
        /ad\./i,
        /ads\./i,
        /banner/i,
        /click\.php/i,
        /track\./i,
        /tracking/i,
        /affiliate/i,
      ];
      if (adPatterns.some(p => p.test(urlStr))) {
        console.log('[AdBlocker] Popup bloqué:', urlStr);
        return null;
      }
      // Bloquer les nouvelles fenêtres qui ne viennent pas d'un clic utilisateur direct
      if (target === '_blank' || target === '_new') {
        console.log('[AdBlocker] Nouvelle fenêtre bloquée:', urlStr);
        return null;
      }
      return originalOpen.call(window, url, target, ...args);
    };

    // 2. Intercepter les tentatives de navigation (beforeunload / unload des iframes)
    const blockNavigation = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    // 3. Surveiller les nouvelles iframes ajoutées dynamiquement par les pubs
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Supprimer les iframes de pub cachées
            const iframes = node.querySelectorAll ? node.querySelectorAll('iframe') : [];
            iframes.forEach((iframe) => {
              const src = iframe.src || '';
              const adDomains = [
                'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
                'adnxs.com', 'rubiconproject.com', 'pubmatic.com', 'openx.net',
                'casalemedia.com', 'criteo.com', 'adsrvr.org', 'moatads.com',
              ];
              if (adDomains.some(d => src.includes(d))) {
                iframe.remove();
                console.log('[AdBlocker] Iframe pub supprimée:', src);
              }
            });

            // Supprimer les overlays/popups de pub (divs positionnés fixed/absolute)
            if (node instanceof HTMLDivElement || node instanceof HTMLDivElement) {
              const style = window.getComputedStyle(node);
              if (
                (style.position === 'fixed' || style.position === 'absolute') &&
                (style.zIndex && parseInt(style.zIndex) > 9999)
              ) {
                const rect = node.getBoundingClientRect();
                // Si c'est un grand overlay
                if (rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.5) {
                  node.remove();
                  console.log('[AdBlocker] Overlay pub supprimé');
                }
              }
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 4. Bloquer les messages postMessage malveillants des iframes
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (typeof data === 'string') {
          const adKeywords = ['popup', 'redirect', 'ad_click', 'openurl'];
          if (adKeywords.some(k => data.toLowerCase().includes(k))) {
            event.stopImmediatePropagation();
            console.log('[AdBlocker] Message pub bloqué:', data.substring(0, 50));
          }
        }
      } catch (_) {}
    };

    window.addEventListener('message', handleMessage, true);

    // Cleanup
    return () => {
      window.open = originalOpen;
      observer.disconnect();
      window.removeEventListener('message', handleMessage, true);
    };
  }, []);

  return null; // Ce composant ne rend rien
};

export default AdBlocker;
