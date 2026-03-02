import titleBg from '@/assets/title-bg.jpg';

interface TitleScreenProps {
  onStart: () => void;
}

export default function TitleScreen({ onStart }: TitleScreenProps) {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${titleBg})`,
          filter: 'brightness(0.6) saturate(1.2)',
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

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
        <div className="text-center mb-12">
          <h1 className="font-pixel text-2xl md:text-4xl text-primary glow-cyan mb-3 tracking-wider">
            FORGOTTEN
          </h1>
          <h1 className="font-pixel text-xl md:text-3xl text-foreground mb-6 tracking-widest">
            DEPTHS
          </h1>
          <div className="w-32 h-px mx-auto bg-gradient-to-r from-transparent via-primary/50 to-transparent mb-4" />
          <p className="font-pixel-body text-sm md:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            You awaken on the ocean floor. No memory. No name.<br />
            Only darkness, and the hum of the deep.
          </p>
        </div>

        <button
          onClick={onStart}
          className="group font-pixel text-xs md:text-sm text-primary glow-cyan
            px-8 py-3 pixel-border bg-secondary/30 hover:bg-primary/20
            transition-all duration-300 hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]
            animate-pulse-glow"
        >
          DESCEND
        </button>

        <div className="mt-12 text-center">
          <p className="font-pixel text-[7px] md:text-[8px] text-muted-foreground/40 tracking-wider">
            WASD TO SWIM &nbsp;•&nbsp; CLICK TO SHOOT &nbsp;•&nbsp; I FOR INVENTORY
          </p>
        </div>
      </div>
    </div>
  );
}
