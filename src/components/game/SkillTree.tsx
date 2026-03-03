import { GameState, STATS, SKILL_BRANCHES, SKILL_NODES, StatId, SkillBranchId, ZONE_NAMES } from '@/game/types';

interface SkillTreeProps {
  state: GameState;
  onClose: () => void;
  onAllocateStat: (id: StatId) => void;
  onUnlockSkill: (id: string) => void;
}

export default function SkillTree({ state, onClose, onAllocateStat, onUnlockSkill }: SkillTreeProps) {
  const { skills } = state;

  const isBranchUnlocked = (branchId: SkillBranchId) => {
    const branch = SKILL_BRANCHES.find(b => b.id === branchId)!;
    return (skills.stats[branch.unlockStat] || 0) >= branch.unlockThreshold;
  };

  const canUnlockNode = (nodeId: string, branch: SkillBranchId, tier: number) => {
    if (skills.skillPoints <= 0) return false;
    if (skills.unlockedSkills.includes(nodeId)) return false;
    if (!isBranchUnlocked(branch)) return false;
    // Must have previous tier unlocked
    if (tier > 1) {
      const prevTierNodes = SKILL_NODES.filter(n => n.branch === branch && n.tier === tier - 1);
      return prevTierNodes.some(n => skills.unlockedSkills.includes(n.id));
    }
    return true;
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50" style={{ fontFamily: '"Press Start 2P", cursive' }}>
      <div className="absolute inset-0 bg-background/90" onClick={onClose} />

      <div className="relative bg-card pixel-border p-4 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-xs text-primary glow-cyan">DIVER SKILL TREE</h2>
            <p className="text-[6px] text-muted-foreground mt-1">ALLOCATE STATS & UNLOCK ABILITIES</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-secondary/50 pixel-border">
              <span className="text-[7px] text-muted-foreground">LVL </span>
              <span className="text-[9px] text-primary glow-cyan">{skills.level}</span>
            </div>
            <div className="px-2 py-1 bg-secondary/50 pixel-border">
              <span className="text-[7px] text-rarity-legendary">◆ {skills.statPoints} SP</span>
            </div>
            <div className="px-2 py-1 bg-secondary/50 pixel-border">
              <span className="text-[7px] text-rarity-epic">★ {skills.skillPoints} AP</span>
            </div>
            <button onClick={onClose} className="text-[8px] text-muted-foreground hover:text-foreground">[ESC]</button>
          </div>
        </div>

        {/* XP Bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[6px] text-muted-foreground">⭐ EXPERIENCE</span>
            <span className="text-[6px] text-rarity-legendary">{skills.xp}/100</span>
          </div>
          <div className="w-full h-1.5 bg-secondary/60 pixel-border">
            <div className="h-full transition-all duration-500" style={{
              width: `${skills.xp}%`,
              background: 'linear-gradient(90deg, hsl(var(--rarity-legendary)), hsl(var(--rarity-legendary) / 0.6))',
            }} />
          </div>
        </div>

        {/* Core Stats */}
        <div className="mb-3">
          <h3 className="text-[7px] text-primary/70 mb-2">— CORE STATS —</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {STATS.map(stat => {
              const val = skills.stats[stat.id] || 0;
              const maxed = val >= stat.maxPoints;
              const canAllocate = skills.statPoints > 0 && !maxed;

              return (
                <div key={stat.id} className="flex items-center gap-1.5 p-1.5 rounded-sm hover:bg-secondary/20 transition-colors">
                  <span className="text-sm w-5 text-center">{stat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[7px] text-foreground">{stat.name}</span>
                      <span className="text-[6px] px-1" style={{
                        color: stat.color,
                        border: `1px solid ${stat.color}33`,
                      }}>{val}/{stat.maxPoints}</span>
                    </div>
                    <div className="flex gap-px mb-0.5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-1 flex-1 rounded-sm" style={{
                          backgroundColor: i < Math.ceil(val / 2) ? stat.color : 'hsl(var(--secondary))',
                          opacity: i < Math.ceil(val / 2) ? 1 : 0.3,
                        }} />
                      ))}
                    </div>
                    <p className="text-[5px] text-muted-foreground truncate">{stat.effectPerPoint}</p>
                  </div>
                  <button
                    onClick={() => onAllocateStat(stat.id)}
                    disabled={!canAllocate}
                    className="w-6 h-6 flex items-center justify-center pixel-border text-xs transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: canAllocate ? `${stat.color}15` : 'transparent',
                      borderColor: canAllocate ? `${stat.color}66` : 'hsl(var(--border) / 0.3)',
                      color: canAllocate ? stat.color : 'hsl(var(--muted-foreground))',
                      boxShadow: canAllocate ? `0 0 8px ${stat.color}33` : 'none',
                    }}
                  >
                    {maxed ? '✓' : '+'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Skill Branches */}
        <div>
          <h3 className="text-[7px] text-primary/70 mb-2">— SKILL BRANCHES —</h3>
          {SKILL_BRANCHES.map(branch => {
            const unlocked = isBranchUnlocked(branch.id);
            const branchNodes = SKILL_NODES.filter(n => n.branch === branch.id).sort((a, b) => a.tier - b.tier);
            const unlockStat = STATS.find(s => s.id === branch.unlockStat)!;
            const statVal = skills.stats[branch.unlockStat] || 0;

            return (
              <div key={branch.id} className="mb-2 p-2 rounded-sm" style={{
                backgroundColor: unlocked ? `${branch.color}08` : 'transparent',
                border: `1px solid ${unlocked ? branch.color + '33' : 'hsl(var(--border) / 0.15)'}`,
              }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">{branch.icon}</span>
                  <span className="text-[8px]" style={{ color: unlocked ? branch.color : 'hsl(var(--muted-foreground))' }}>
                    {branch.name}
                  </span>
                  {!unlocked && (
                    <span className="text-[5px] text-muted-foreground/60">
                      🔒 Requires {unlockStat.icon} {branch.unlockThreshold} {unlockStat.name} ({statVal}/{branch.unlockThreshold})
                    </span>
                  )}
                </div>

                {unlocked && (
                  <div className="flex gap-1">
                    {branchNodes.map(node => {
                      const isOwned = skills.unlockedSkills.includes(node.id);
                      const canBuy = canUnlockNode(node.id, branch.id, node.tier);

                      return (
                        <button
                          key={node.id}
                          onClick={() => canBuy && onUnlockSkill(node.id)}
                          disabled={!canBuy && !isOwned}
                          className="flex-1 p-1.5 rounded-sm transition-all text-center"
                          title={`${node.name}: ${node.description}`}
                          style={{
                            backgroundColor: isOwned ? `${node.color}20` : canBuy ? `${node.color}08` : 'transparent',
                            border: `1px solid ${isOwned ? node.color + '66' : canBuy ? node.color + '33' : 'hsl(var(--border) / 0.15)'}`,
                            cursor: canBuy ? 'pointer' : isOwned ? 'default' : 'not-allowed',
                            boxShadow: isOwned ? `0 0 8px ${node.color}22` : 'none',
                          }}
                        >
                          <div className="text-xs mb-0.5">{node.icon}</div>
                          <div className="text-[5px] truncate" style={{
                            color: isOwned ? node.color : canBuy ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground) / 0.5)',
                          }}>{node.name}</div>
                          {isOwned && <div className="text-[5px]" style={{ color: node.color }}>✓</div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 text-center">
          <span className="text-[6px] text-muted-foreground/50">Press K to close • SP = Stat Points • AP = Ability Points</span>
        </div>
      </div>
    </div>
  );
}
