import { GameState, RARITY_COLORS, ZONE_NAMES } from '@/game/types';
import Minimap from './Minimap';

interface HUDProps {
  state: GameState | null;
}

export default function HUD({ state }: HUDProps) {
  if (!state) return null;
  const { player } = state;

  const oxygenPct = (player.oxygen / player.maxOxygen) * 100;
  const hpPct = (player.hp / player.maxHp) * 100;

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ fontFamily: '"Press Start 2P", cursive' }}>
      {/* Top bars */}
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        {/* HP Bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] w-8" style={{ color: hpPct > 50 ? '#44cc66' : hpPct > 25 ? '#ccaa22' : '#cc3333' }}>❤️</span>
          <div className="relative w-44 h-4 bg-secondary/70 pixel-border overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${hpPct}%`,
                background: hpPct > 50
                  ? 'linear-gradient(90deg, #22994488, #44cc66)'
                  : hpPct > 25
                  ? 'linear-gradient(90deg, #aa880088, #ccaa22)'
                  : 'linear-gradient(90deg, #99222288, #cc3333)',
                boxShadow: hpPct <= 25 ? '0 0 8px #cc3333' : 'none',
              }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[8px] text-foreground/90 drop-shadow-md">
              {Math.ceil(player.hp)} / {Math.ceil(player.maxHp)}
            </span>
          </div>
        </div>
        {/* Oxygen Bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] w-8">🫧</span>
          <div className="relative w-44 h-4 bg-secondary/70 pixel-border overflow-hidden">
            <div
              className="h-full bg-oxygen transition-all duration-300"
              style={{
                width: `${oxygenPct}%`,
                background: oxygenPct > 30
                  ? 'linear-gradient(90deg, hsl(195, 90%, 30%), hsl(195, 90%, 50%))'
                  : 'linear-gradient(90deg, hsl(0, 70%, 30%), hsl(0, 70%, 50%))',
                opacity: oxygenPct < 25 ? 0.5 + Math.sin(Date.now() * 0.01) * 0.5 : 1,
                boxShadow: oxygenPct < 25 ? '0 0 8px hsl(0, 70%, 50%)' : '0 0 6px hsl(195, 90%, 50%, 0.3)',
              }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[8px] text-foreground/90 drop-shadow-md">
              {Math.ceil(player.oxygen)}%
            </span>
          </div>
        </div>
        {/* Zone */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[7px] text-muted-foreground">📍</span>
          <span className="text-[7px] text-primary/70">{ZONE_NAMES[state.depthZone] || 'Unknown'}</span>
        </div>
      </div>

      {/* Score, Level, Stats + Minimap */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
        <span className="text-[8px] text-primary glow-cyan">{state.score}</span>
        <div className="flex items-center gap-1">
          <span className="text-[6px] text-rarity-legendary">LV{state.skills.level}</span>
          <div className="w-14 h-1.5 bg-secondary/60">
            <div className="h-full bg-rarity-legendary transition-all duration-300" style={{ width: `${state.skills.xp}%` }} />
          </div>
        </div>
        {state.skills.statPoints > 0 && (
          <span className="text-[6px] text-rarity-legendary animate-pulse-glow">◆ {state.skills.statPoints} SP — Press K</span>
        )}
        {state.skills.skillPoints > 0 && (
          <span className="text-[6px] text-rarity-epic animate-pulse-glow">★ {state.skills.skillPoints} AP</span>
        )}
        <div className="mt-1">
          <Minimap state={state} />
        </div>
      </div>

      {/* Quickslot bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-auto">
        {player.quickslots.map((slot, i) => (
          <div
            key={i}
            className={`relative w-11 h-11 flex items-center justify-center pixel-border transition-all
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
