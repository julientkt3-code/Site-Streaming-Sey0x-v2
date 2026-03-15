import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 — route inexistante:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-6">
        {/* Illustration */}
        <div className="text-8xl font-black text-white/10 select-none mb-2">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Page introuvable</h1>
        <p className="text-white/50 mb-8 max-w-xs mx-auto">
          Cette page n'existe pas ou a été déplacée.
        </p>

        {/* Boutons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="
              flex items-center justify-center gap-2 px-5 py-2.5
              bg-white/10 hover:bg-white/20 active:scale-95
              border border-white/20 rounded-xl text-white text-sm font-medium
              transition-all duration-150
            "
          >
            <ArrowLeft size={16} />
            Retour
          </button>

          <button
            onClick={() => navigate('/')}
            className="
              flex items-center justify-center gap-2 px-5 py-2.5
              bg-white text-black hover:bg-white/90 active:scale-95
              rounded-xl text-sm font-bold
              transition-all duration-150
            "
          >
            <Home size={16} />
            Accueil
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
