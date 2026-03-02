import { GameState, SKILLS, MAX_SKILL_LEVEL, SkillId } from '@/game/types';

interface SkillTreeProps {
  state: GameState;
  onClose: () => void;
  onUpgradeSkill: (id: SkillId) => void;
}

export default function SkillTree({ state, onClose, onUpgradeSkill }: SkillTreeProps) {
  const { skills } = state;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50" style={{ fontFamily: '"Press Start 2P", cursive' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/85" onClick={onClose} />

      <div className="relative bg-card pixel-border p-4 max-w-lg w-full mx-4">
        {/* Scanline effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
          <div className="w-full h-[2px] bg-primary animate-pulse-glow" />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xs text-primary glow-cyan">SKILL TREE</h2>
            <p className="text-[6px] text-muted-foreground mt-1">UPGRADE DIVER ABILITIES</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-secondary/50 pixel-border">
                <span className="text-[7px] text-muted-foreground">LVL </span>
                <span className="text-[9px] text-primary glow-cyan">{skills.level}</span>
              </div>
              <div className="px-2 py-1 bg-secondary/50 pixel-border">
                <span className="text-[7px] text-rarity-legendary">◆ {skills.skillPoints} SP</span>
              </div>
            </div>
            <button onClick={onClose} className="text-[8px] text-muted-foreground hover:text-foreground">
              [ESC]
            </button>
          </div>
        </div>

        {/* XP Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[6px] text-muted-foreground">⭐ EXPERIENCE</span>
            <span className="text-[6px] text-rarity-legendary">{skills.xp}/100</span>
          </div>
          <div className="w-full h-1.5 bg-secondary/60 pixel-border">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${skills.xp}%`,
                background: 'linear-gradient(90deg, hsl(var(--rarity-legendary)), hsl(var(--rarity-legendary) / 0.6))',
              }}
            />
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-1.5">
          {SKILLS.map(skill => {
            const lvl = skills.levels[skill.id];
            const maxed = lvl >= MAX_SKILL_LEVEL;
            const canUpgrade = skills.skillPoints > 0 && !maxed;

            return (
              <div
                key={skill.id}
                className="flex items-center gap-2 p-2 rounded-sm transition-colors hover:bg-secondary/20"
              >
                {/* Icon */}
                <span className="text-lg w-7 text-center">{skill.icon}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[8px] text-foreground">{skill.name}</span>
                    <span
                      className="text-[6px] px-1 py-0.5"
                      style={{
                        color: maxed ? 'hsl(var(--rarity-uncommon))' : skill.color,
                        backgroundColor: maxed ? 'hsl(var(--rarity-uncommon) / 0.1)' : `${skill.color}15`,
                        border: `1px solid ${maxed ? 'hsl(var(--rarity-uncommon) / 0.3)' : skill.color + '33'}`,
                      }}
                    >
                      {maxed ? 'MAX' : `${lvl}/${MAX_SKILL_LEVEL}`}
                    </span>
                  </div>

                  {/* Level pips */}
                  <div className="flex gap-0.5 mb-1">
                    {Array.from({ length: MAX_SKILL_LEVEL }).map((_, i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-sm transition-all"
                        style={{
                          backgroundColor: i < lvl ? skill.color : 'hsl(var(--secondary))',
                          boxShadow: i < lvl ? `0 0 4px ${skill.color}44` : 'none',
                        }}
                      />
                    ))}
                  </div>

                  {/* Description */}
                  <p className="text-[6px] text-muted-foreground truncate">
                    {skill.levels[Math.min(lvl, MAX_SKILL_LEVEL - 1)]} — {skill.description}
                  </p>
                </div>

                {/* Upgrade button */}
                <button
                  onClick={() => onUpgradeSkill(skill.id)}
                  disabled={!canUpgrade}
                  className="w-8 h-8 flex items-center justify-center pixel-border text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: canUpgrade ? `${skill.color}15` : 'hsl(var(--secondary) / 0.3)',
                    borderColor: canUpgrade ? `${skill.color}66` : 'hsl(var(--border) / 0.3)',
                    color: canUpgrade ? skill.color : 'hsl(var(--muted-foreground))',
                    boxShadow: canUpgrade ? `0 0 12px ${skill.color}33` : 'none',
                  }}
                >
                  {maxed ? '✓' : '+'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Controls hint */}
        <div className="mt-3 text-center">
          <span className="text-[6px] text-muted-foreground/50">Press K to close</span>
        </div>
      </div>
    </div>
  );
}
