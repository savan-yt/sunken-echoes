import { useState, useEffect } from 'react';

interface MemoryFragmentOverlayProps {
  title: string;
  text: string;
  onClose: () => void;
}

export default function MemoryFragmentOverlay({ title, text, onClose }: MemoryFragmentOverlayProps) {
  const [phase, setPhase] = useState<'flash' | 'reveal' | 'text' | 'idle'>('flash');
  const [visibleChars, setVisibleChars] = useState(0);

  useEffect(() => {
    // Flash phase
    const t1 = setTimeout(() => setPhase('reveal'), 400);
    const t2 = setTimeout(() => setPhase('text'), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (phase !== 'text') return;
    if (visibleChars >= text.length) {
      setPhase('idle');
      return;
    }
    const t = setTimeout(() => setVisibleChars(v => v + 2), 20);
    return () => clearTimeout(t);
  }, [phase, visibleChars, text.length]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={phase === 'idle' ? onClose : undefined}
    >
      {/* Background */}
      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: phase === 'flash'
            ? 'radial-gradient(circle, rgba(180,140,255,0.9) 0%, rgba(20,5,40,0.95) 70%)'
            : 'radial-gradient(circle, rgba(40,20,80,0.95) 0%, rgba(5,2,15,0.98) 70%)',
        }}
      />

      {/* Floating particles */}
      {phase !== 'flash' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 2 + Math.random() * 4,
                height: 2 + Math.random() * 4,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                background: `rgba(${150 + Math.random() * 105}, ${100 + Math.random() * 80}, 255, ${0.3 + Math.random() * 0.4})`,
                animation: `float-particle ${3 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div
        className="relative z-10 max-w-lg w-full mx-4 transition-all duration-1000"
        style={{
          opacity: phase === 'flash' ? 0 : 1,
          transform: phase === 'flash' ? 'scale(0.8) translateY(20px)' : 'scale(1) translateY(0)',
        }}
      >
        {/* Memory crystal icon */}
        <div className="text-center mb-4">
          <div
            className="inline-block text-5xl"
            style={{
              filter: 'drop-shadow(0 0 20px rgba(160,100,255,0.8))',
              animation: 'pulse-glow 2s ease-in-out infinite',
            }}
          >
            🧠
          </div>
        </div>

        {/* Title */}
        <h2
          className="text-center mb-6 tracking-widest uppercase"
          style={{
            fontFamily: '"Press Start 2P", cursive',
            fontSize: '11px',
            color: '#c8a0ff',
            textShadow: '0 0 15px rgba(160,100,255,0.6)',
            letterSpacing: '3px',
          }}
        >
          {title}
        </h2>

        {/* Text container */}
        <div
          className="relative p-6 rounded"
          style={{
            background: 'rgba(20,10,40,0.7)',
            border: '1px solid rgba(160,100,255,0.3)',
            boxShadow: '0 0 30px rgba(160,100,255,0.1), inset 0 0 30px rgba(160,100,255,0.05)',
          }}
        >
          {/* Scan line effect */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden rounded"
            style={{ opacity: 0.05 }}
          >
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="w-full"
                style={{
                  height: 1,
                  marginBottom: 3,
                  background: 'rgba(160,100,255,0.5)',
                }}
              />
            ))}
          </div>

          <p
            style={{
              fontFamily: '"Press Start 2P", cursive',
              fontSize: '8px',
              lineHeight: '18px',
              color: '#b8a0d8',
              textShadow: '0 0 4px rgba(160,100,255,0.3)',
              minHeight: 100,
            }}
          >
            {text.slice(0, visibleChars)}
            {phase === 'text' && (
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 10,
                  background: '#c8a0ff',
                  marginLeft: 2,
                  animation: 'blink-cursor 0.6s step-end infinite',
                }}
              />
            )}
          </p>
        </div>

        {/* Continue prompt */}
        {phase === 'idle' && (
          <p
            className="text-center mt-6"
            style={{
              fontFamily: '"Press Start 2P", cursive',
              fontSize: '7px',
              color: '#8860aa',
              animation: 'blink-cursor 1.2s step-end infinite',
            }}
          >
            Click anywhere to continue...
          </p>
        )}
      </div>

      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-30px) translateX(10px); opacity: 0.7; }
        }
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(160,100,255,0.8)); }
          50% { transform: scale(1.1); filter: drop-shadow(0 0 35px rgba(160,100,255,1)); }
        }
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
