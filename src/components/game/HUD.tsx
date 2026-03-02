import { GameState, RARITY_COLORS } from '@/game/types';

interface HUDProps {
  state: GameState | null;
}

export default function HUD({ state }: HUDProps) {
  if (!state) return null;
  const { player } = state;

  const oxygenPct = (player.oxygen / player.maxOxygen) * 100;
  const hpPct = (player.hp / player.maxHp) * 100;

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none select-none" style={{ fontFamily: '"Press Start 2P", cursive' }}>
      {/* Top bars */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
        {/* HP */}
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] text-health w-6">HP</span>
          <div className="w-24 h-2 bg-secondary/60 pixel-border">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${hpPct}%`,
                backgroundColor: hpPct > 50 ? '#44cc66' : hpPct > 25 ? '#ccaa22' : '#cc3333',
              }}
            />
          </div>
          <span className="text-[7px] text-foreground/70">{Math.ceil(player.hp)}</span>
        </div>
        {/* Oxygen */}
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] text-oxygen w-6">O₂</span>
          <div className="w-24 h-2 bg-secondary/60 pixel-border">
            <div
              className="h-full bg-oxygen transition-all duration-300"
              style={{ width: `${oxygenPct}%`, opacity: oxygenPct < 25 ? 0.5 + Math.sin(Date.now() * 0.01) * 0.5 : 1 }}
            />
          </div>
          <span className="text-[7px] text-foreground/70">{Math.ceil(player.oxygen)}%</span>
        </div>
      </div>

      {/* Score & Level */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
        <span className="text-[8px] text-primary glow-cyan">{state.score}</span>
        <div className="flex items-center gap-1">
          <span className="text-[6px] text-rarity-legendary">LV{state.skills.level}</span>
          <div className="w-12 h-1 bg-secondary/60">
            <div className="h-full bg-rarity-legendary transition-all duration-300" style={{ width: `${state.skills.xp}%` }} />
          </div>
        </div>
      </div>

      {/* Quickslot bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-auto">
        {player.quickslots.map((slot, i) => (
          <div
            key={i}
            className={`relative w-10 h-10 flex items-center justify-center pixel-border transition-all
              ${i === player.activeQuickslot ? 'border-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)]' : 'border-border/50'}
            `}
            style={{ backgroundColor: 'hsl(220, 45%, 10%)' }}
          >
            <span className="absolute top-0.5 left-1 text-[6px] text-muted-foreground">{i + 1}</span>
            {slot && (
              <>
                <span className="text-sm">{slot.item.icon}</span>
                {slot.count > 1 && (
                  <span className="absolute bottom-0.5 right-1 text-[6px]" style={{ color: RARITY_COLORS[slot.item.rarity] }}>
                    {slot.count}
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-3 right-3">
        <div className="text-[6px] text-muted-foreground/50 space-y-0.5 text-right">
          <div>WASD move</div>
          <div>Click shoot</div>
          <div>I inventory</div>
          <div>K skills</div>
          <div>E use item</div>
        </div>
      </div>

      {/* Game Over */}
      {state.gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 pointer-events-auto">
          <div className="text-center">
            <h2 className="text-lg text-health glow-cyan mb-2">OXYGEN DEPLETED</h2>
            <p className="text-[8px] text-muted-foreground mb-3">The depths have claimed another soul...</p>
            <p className="text-[7px] text-primary animate-pulse-glow">Press R to restart</p>
          </div>
        </div>
      )}

      {/* Low oxygen warning */}
      {player.oxygen < 20 && !state.gameOver && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            border: `3px solid rgba(255, 50, 50, ${0.3 + Math.sin(Date.now() * 0.005) * 0.3})`,
            boxShadow: `inset 0 0 30px rgba(255, 0, 0, ${0.1 + Math.sin(Date.now() * 0.005) * 0.1})`,
          }}
        />
      )}
    </div>
  );
}
