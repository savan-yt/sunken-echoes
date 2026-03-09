import { useState, useRef, useCallback } from 'react';
import titleBg from '@/assets/title-bg.jpg';
import CoopLobby from './CoopLobby';

interface TitleScreenProps {
  onStart: () => void;
}

export default function TitleScreen({ onStart }: TitleScreenProps) {
  const [showCoop, setShowCoop] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const { clientX, clientY, currentTarget } = e;
      const { width, height } = currentTarget.getBoundingClientRect();
      // Max shift: ±1.5%
      const x = ((clientX / width) - 0.5) * -3;
      const y = ((clientY / height) - 0.5) * -3;
      setParallax({ x, y });
    });
  }, []);

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-background"
      onMouseMove={handleMouseMove}
    >
      {/* Background image with parallax */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${titleBg})`,
          filter: 'brightness(0.6) saturate(1.2)',
          animation: 'bg-sway 20s ease-in-out infinite',
          transform: `scale(1.08) translate(${parallax.x}%, ${parallax.y}%)`,
          transition: 'transform 0.12s ease-out',
        }}
      />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

      {/* Animated particles overlay */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float-up"
            style={{
              left: `${10 + Math.random() * 80}%`,
              bottom: `-${Math.random() * 20}px`,
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              backgroundColor: 'hsl(var(--primary) / 0.3)',
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Co-op Lobby Overlay */}
      {showCoop && (
        <CoopLobby onBack={() => setShowCoop(false)} onStartGame={onStart} />
      )}

      {/* Content */}
      {!showCoop && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
          <div className="text-center mb-12 animate-fade-in-up">
            <h1 className="font-pixel text-2xl md:text-4xl text-primary glow-cyan mb-3 tracking-wider animate-title-glow">
              FORGOTTEN
            </h1>
            <h1 className="font-pixel text-xl md:text-3xl text-foreground mb-6 tracking-widest animate-fade-in-up animation-delay-200">
              DEPTHS
            </h1>
            <div className="w-32 h-px mx-auto bg-gradient-to-r from-transparent via-primary/50 to-transparent mb-4 animate-expand-width" />
            <p className="font-pixel-body text-sm md:text-base text-muted-foreground max-w-md mx-auto leading-relaxed animate-fade-in-up animation-delay-400">
              You awaken on the ocean floor. No memory. No name.<br />
              Only darkness, and the hum of the deep.
            </p>
          </div>

          <div className="space-y-3 w-full max-w-xs">
            <button
              onClick={onStart}
              className="w-full group font-pixel text-xs md:text-sm text-primary glow-cyan
                px-8 py-3 pixel-border bg-secondary/30 hover:bg-primary/20
                transition-all duration-300 hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]
                hover:scale-105 animate-fade-in-up animation-delay-600
                animate-pulse-glow"
            >
              SOLO DIVE
            </button>

            <button
              onClick={() => setShowCoop(true)}
              className="w-full group font-pixel text-xs md:text-sm text-accent
                px-8 py-3 pixel-border bg-secondary/30 hover:bg-accent/20
                transition-all duration-300 hover:shadow-[0_0_20px_hsl(var(--accent)/0.3)]
                hover:scale-105 animate-fade-in-up animation-delay-800"
            >
              🤝 CO-OP
            </button>
          </div>

          <div className="mt-12 text-center animate-fade-in-up animation-delay-1000">
            <p className="font-pixel text-[7px] md:text-[8px] text-muted-foreground/40 tracking-wider">
              WASD TO SWIM &nbsp;•&nbsp; CLICK TO SHOOT &nbsp;•&nbsp; I FOR INVENTORY
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
