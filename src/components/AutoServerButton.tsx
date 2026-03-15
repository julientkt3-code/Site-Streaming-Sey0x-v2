import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Provider, providers, setFavoriteProvider } from '@/utils/providers';

interface AutoServerButtonProps {
  currentProvider: Provider;
  onProviderChange: (provider: Provider) => void;
}

const AutoServerButton: React.FC<AutoServerButtonProps> = ({ currentProvider, onProviderChange }) => {
  const [spinning, setSpinning] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const handleSwitch = () => {
    const currentIndex = providers.findIndex(p => p.id === currentProvider.id);
    const nextIndex = (currentIndex + 1) % providers.length;
    const nextProvider = providers[nextIndex];

    setSpinning(true);
    setTimeout(() => setSpinning(false), 600);

    onProviderChange(nextProvider);
    setFavoriteProvider(nextProvider.id);

    setToastMsg(`Serveur : ${nextProvider.name.replace(' ⭐', '')}`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  return (
    <div className="relative">
      {/* Toast discret en haut du bouton */}
      {showToast && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap
            bg-black/80 text-white text-xs px-3 py-1.5 rounded-full
            animate-fade-in pointer-events-none z-50 backdrop-blur-sm"
        >
          {toastMsg}
        </div>
      )}

      <button
        onClick={handleSwitch}
        title="Changer de serveur"
        className="
          flex items-center gap-1.5 px-3 py-1.5
          bg-white/10 hover:bg-white/20 active:scale-95
          border border-white/20 hover:border-white/40
          rounded-full text-white text-xs font-medium
          transition-all duration-200
          backdrop-blur-sm
        "
      >
        <RefreshCw
          size={13}
          className={`transition-transform duration-500 ${spinning ? 'rotate-[360deg]' : ''}`}
          style={{ transition: spinning ? 'transform 0.5s ease' : 'none' }}
        />
        <span className="opacity-80">Serveur suivant</span>
      </button>
    </div>
  );
};

export default AutoServerButton;
