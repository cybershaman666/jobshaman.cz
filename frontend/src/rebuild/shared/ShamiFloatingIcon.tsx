import React from 'react';
import { cn } from '../cn';

interface ShamiFloatingIconProps {
  isOpen: boolean;
  onClick: () => void;
  unread?: boolean;
}

export const ShamiFloatingIcon: React.FC<ShamiFloatingIconProps> = ({
  isOpen,
  onClick,
  unread = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? 'Zavřít Shami chat' : 'Otevřít Shami chat'}
      className={cn(
        'group fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-2xl',
        'shadow-[0_8px_32px_rgba(18,175,203,0.35)] transition-all duration-300 ease-out',
        'hover:shadow-[0_12px_40px_rgba(18,175,203,0.5)] hover:scale-105 active:scale-95',
        isOpen
          ? 'bg-white ring-2 ring-[#12afcb]/30 rotate-0'
          : 'bg-gradient-to-br from-[#12afcb] to-[#0f95ac]',
      )}
      style={{
        backdropFilter: isOpen ? 'blur(8px)' : 'none',
      }}
    >
      {/* Pulse ring animation when closed */}
      {!isOpen && (
        <span className="absolute inset-0 animate-ping rounded-2xl bg-[#12afcb]/30 opacity-75" />
      )}

      {/* Shami avatar */}
      <div className={cn(
        'relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl transition-transform duration-300',
        isOpen ? 'scale-90' : 'scale-100',
      )}>
        <img
          src="/shami.png"
          alt="Shami"
          className="h-11 w-11 object-contain drop-shadow-md"
        />
      </div>

      {/* Unread indicator */}
      {unread && !isOpen && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-lg ring-2 ring-white">
          !
        </span>
      )}

      {/* Close icon when open */}
      {isOpen && (
        <span className="absolute text-2xl font-light text-slate-500 leading-none -translate-y-[0.5px]">
          ×
        </span>
      )}
    </button>
  );
};

export default ShamiFloatingIcon;