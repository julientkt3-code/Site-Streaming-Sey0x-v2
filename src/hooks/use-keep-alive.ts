import { useEffect } from 'react';

/**
 * useKeepAlive — ping le serveur toutes les 14 minutes pour éviter
 * la mise en veille automatique de Render (plan gratuit = veille après 15 min)
 */
const useKeepAlive = () => {
  useEffect(() => {
    // Ping toutes les 14 minutes (840 000 ms)
    const INTERVAL = 14 * 60 * 1000;

    const ping = async () => {
      try {
        await fetch('/ping', { method: 'GET', cache: 'no-store' });
        console.log('[KeepAlive] Ping envoyé à', new Date().toLocaleTimeString());
      } catch (_) {
        // Silencieux si erreur réseau
      }
    };

    const timer = setInterval(ping, INTERVAL);

    // Cleanup
    return () => clearInterval(timer);
  }, []);
};

export default useKeepAlive;
