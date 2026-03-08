export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  stackable: boolean;
  maxStack: number;
  icon: string;
  category: 'weapon' | 'material' | 'consumable' | 'gear';
}

export interface InventorySlot {
  item: ItemDef;
  count: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Entity {
  pos: Vec2;
  vel: Vec2;
  width: number;
  height: number;
}

export interface Player extends Entity {
  facing: number;
  oxygen: number;
  maxOxygen: number;
  hp: number;
  maxHp: number;
  shootCooldown: number;
  invincible: number;
  inventory: (InventorySlot | null)[];
  quickslots: (InventorySlot | null)[];
  activeQuickslot: number;
  animFrame: number;
  animTimer: number;
  swimBobble: number;
}

export interface Projectile extends Entity {
  damage: number;
  lifetime: number;
  fromPlayer: boolean;
  type: string;
}

export interface Creature extends Entity {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  facing: number;
  behavior: 'patrol' | 'chase' | 'ambush';
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';
  attackCooldown: number;
  attackRange: number;
  patrolOrigin: Vec2;
  patrolRange: number;
  lootTable: LootEntry[];
  deathTimer: number;
  spriteType: string;
  rangedAttack?: string;
  rangedCooldown: number;
  animFrame: number;
  animTimer: number;
  corruptionPulse: number;
  xpValue: number;
  poisonTimer: number;
  poisonDamage: number;
}

export interface LootEntry {
  itemId: string;
  chance: number;
  minCount: number;
  maxCount: number;
}

export interface DroppedItem {
  pos: Vec2;
  vel: Vec2;
  item: ItemDef;
  count: number;
  lifetime: number;
  bobOffset: number;
}

export interface MemoryFragment {
  pos: Vec2;
  vel: Vec2;
  lifetime: number;
  bobOffset: number;
  collected: boolean;
  collectTimer: number;
  text: string;
  title: string;
}

export type BossPhase = 1 | 2 | 3;

export interface BossState {
  active: boolean;
  phase: BossPhase;
  creatureId: string;
  chargeTimer: number;
  chargeDir: Vec2;
  isCharging: boolean;
  chargeCooldown: number;
  comboCount: number;
  comboCooldown: number;
  phaseTransition: number; // timer for phase transition animation
  roarTimer: number;
  defeated: boolean;
}

export interface AirBubble {
  pos: Vec2;
  size: number;
  active: boolean;
  respawnTimer: number;
}

export interface Particle {
  pos: Vec2;
  vel: Vec2;
  lifetime: number;
  maxLifetime: number;
  size: number;
  color: string;
  type: 'bubble' | 'glow' | 'damage' | 'pickup' | 'corruption' | 'light' | 'boss_charge' | 'memory' | 'pickup_text' | 'damage_text' | 'poison';
  text?: string;
}

// ======== STAT & SKILL SYSTEM ========

export type StatId = 'vitality' | 'strength' | 'endurance' | 'lungCapacity' | 'precision' | 'agility';

export interface StatDef {
  id: StatId;
  name: string;
  icon: string;
  description: string;
  effectPerPoint: string;
  maxPoints: number;
  color: string;
}

export const STATS: StatDef[] = [
  { id: 'vitality', name: 'Vitality', icon: '❤️', description: '+8 Max Health per point', effectPerPoint: '+8 HP', maxPoints: 20, color: 'hsl(0, 70%, 55%)' },
  { id: 'strength', name: 'Strength', icon: '⚡', description: '+5 Attack Damage per point', effectPerPoint: '+5 DMG', maxPoints: 20, color: 'hsl(30, 80%, 55%)' },
  { id: 'endurance', name: 'Endurance', icon: '🛡️', description: '+4 Defense per point', effectPerPoint: '+4 DEF', maxPoints: 20, color: 'hsl(120, 50%, 50%)' },
  { id: 'lungCapacity', name: 'Lung Capacity', icon: '🫧', description: '+6 Max Oxygen per point', effectPerPoint: '+6 O₂', maxPoints: 20, color: 'hsl(195, 90%, 50%)' },
  { id: 'precision', name: 'Precision', icon: '🎯', description: '+3% Critical Hit Chance per point', effectPerPoint: '+3% CRIT', maxPoints: 20, color: 'hsl(45, 90%, 55%)' },
  { id: 'agility', name: 'Agility', icon: '💨', description: '+4% Movement Speed per point', effectPerPoint: '+4% SPD', maxPoints: 20, color: 'hsl(270, 70%, 60%)' },
];

export type SkillBranchId = 'combat' | 'stealth' | 'survival' | 'salvage';

export interface SkillNodeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  branch: SkillBranchId;
  tier: number; // 1-5
  color: string;
}

export const SKILL_BRANCHES: { id: SkillBranchId; name: string; icon: string; color: string; unlockStat: StatId; unlockThreshold: number }[] = [
  { id: 'combat', name: 'Combat', icon: '⚔️', color: 'hsl(0, 70%, 55%)', unlockStat: 'strength', unlockThreshold: 5 },
  { id: 'stealth', name: 'Stealth', icon: '🥷', color: 'hsl(270, 70%, 60%)', unlockStat: 'agility', unlockThreshold: 5 },
  { id: 'survival', name: 'Survival', icon: '🛡️', color: 'hsl(120, 50%, 50%)', unlockStat: 'endurance', unlockThreshold: 5 },
  { id: 'salvage', name: 'Salvage', icon: '🔬', color: 'hsl(195, 90%, 50%)', unlockStat: 'lungCapacity', unlockThreshold: 5 },
];

export const SKILL_NODES: SkillNodeDef[] = [
  // Combat branch
  { id: 'harpoon1', name: 'Harpoon Mastery I', icon: '🔱', description: '+15% harpoon damage', branch: 'combat', tier: 1, color: 'hsl(0, 70%, 55%)' },
  { id: 'harpoon2', name: 'Harpoon Mastery II', icon: '🔱', description: '+25% damage, charged shot', branch: 'combat', tier: 2, color: 'hsl(0, 70%, 55%)' },
  { id: 'hunterInstinct', name: "Hunter's Instinct", icon: '👁️', description: 'Highlight enemy weakpoints', branch: 'combat', tier: 3, color: 'hsl(0, 70%, 55%)' },
  { id: 'berserker', name: 'Berserker', icon: '🔥', description: 'Below 25% HP: +40% damage', branch: 'combat', tier: 4, color: 'hsl(0, 70%, 55%)' },
  { id: 'execution', name: 'Execution', icon: '💀', description: 'Kill low HP enemies with shockwave', branch: 'combat', tier: 5, color: 'hsl(0, 70%, 55%)' },
  // Stealth branch
  { id: 'shadow1', name: 'Shadow Swim I', icon: '🌑', description: '-20% detection radius', branch: 'stealth', tier: 1, color: 'hsl(270, 70%, 60%)' },
  { id: 'shadow2', name: 'Shadow Swim II', icon: '🌑', description: '-40% detection, silent move', branch: 'stealth', tier: 2, color: 'hsl(270, 70%, 60%)' },
  { id: 'ambush', name: 'Ambush', icon: '🗡️', description: 'First stealth attack: 2x damage', branch: 'stealth', tier: 3, color: 'hsl(270, 70%, 60%)' },
  { id: 'ghostCurrent', name: 'Ghost Current', icon: '👻', description: 'No movement disturbance trail', branch: 'stealth', tier: 4, color: 'hsl(270, 70%, 60%)' },
  { id: 'phantomDive', name: 'Phantom Dive', icon: '💨', description: 'Brief invisibility after damage', branch: 'stealth', tier: 5, color: 'hsl(270, 70%, 60%)' },
  // Survival branch
  { id: 'tough1', name: 'Tough Skin I', icon: '🧱', description: '-8% all damage taken', branch: 'survival', tier: 1, color: 'hsl(120, 50%, 50%)' },
  { id: 'tough2', name: 'Tough Skin II', icon: '🧱', description: '-16% damage, no knockback', branch: 'survival', tier: 2, color: 'hsl(120, 50%, 50%)' },
  { id: 'pressureAdapt', name: 'Pressure Adapt', icon: '🌊', description: 'Slow O₂ drain in deep zones', branch: 'survival', tier: 3, color: 'hsl(120, 50%, 50%)' },
  { id: 'regen', name: 'Regeneration', icon: '💚', description: 'Recover HP out of combat', branch: 'survival', tier: 4, color: 'hsl(120, 50%, 50%)' },
  { id: 'ironLung', name: 'Iron Lung', icon: '🫁', description: 'Survive 5s at 0 oxygen', branch: 'survival', tier: 5, color: 'hsl(120, 50%, 50%)' },
  // Salvage branch
  { id: 'scav1', name: 'Scavenger I', icon: '🔍', description: '+10% item drop chance', branch: 'salvage', tier: 1, color: 'hsl(195, 90%, 50%)' },
  { id: 'scav2', name: 'Scavenger II', icon: '🔍', description: '+20% drops, more rares', branch: 'salvage', tier: 2, color: 'hsl(195, 90%, 50%)' },
  { id: 'dissection', name: 'Dissection Expert', icon: '🔬', description: 'Bio materials drop more', branch: 'salvage', tier: 3, color: 'hsl(195, 90%, 50%)' },
  { id: 'efficientCraft', name: 'Efficient Crafter', icon: '🔧', description: '-20% crafting costs', branch: 'salvage', tier: 4, color: 'hsl(195, 90%, 50%)' },
  { id: 'treasureSense', name: 'Treasure Sense', icon: '✨', description: 'Hidden loot glows through walls', branch: 'salvage', tier: 5, color: 'hsl(195, 90%, 50%)' },
];

export const MAX_SKILL_LEVEL = 5;
export const XP_PER_LEVEL = 100;
export const STAT_POINTS_PER_LEVEL = 3;

// Keep old SkillId for backwards compat
export type SkillId = 'diving' | 'combat' | 'stealth' | 'crafting' | 'resilience';

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  description: string;
  levels: string[];
  color: string;
}

export const SKILLS: SkillDef[] = [
  { id: 'diving', name: 'Deep Diving', icon: '🤿', description: 'Reduces oxygen drain rate in deeper zones', levels: ['Shallow breath', 'Seasoned diver', 'Abyss walker', 'Void breather', 'One with the deep'], color: 'hsl(var(--oxygen))' },
  { id: 'combat', name: 'Harpoon Mastery', icon: '🔱', description: 'Increases harpoon damage and attack speed', levels: ['Rusty aim', 'Steady hand', 'Swift strike', 'Deep hunter', 'Apex predator'], color: 'hsl(var(--health))' },
  { id: 'stealth', name: 'Shadow Swim', icon: '🥷', description: 'Reduces detection radius from corrupted creatures', levels: ['Clumsy', 'Subtle', 'Silent', 'Phantom', 'Invisible'], color: 'hsl(var(--rarity-epic))' },
  { id: 'crafting', name: 'Salvage Expert', icon: '🔧', description: 'Increases item drop quality and crafting efficiency', levels: ['Scavenger', 'Tinkerer', 'Engineer', 'Artificer', 'Master Salvager'], color: 'hsl(var(--rarity-legendary))' },
  { id: 'resilience', name: 'Pressure Skin', icon: '🛡️', description: 'Increases max health and reduces damage taken', levels: ['Fragile', 'Toughened', 'Hardened', 'Ironclad', 'Leviathan Hide'], color: 'hsl(var(--rarity-uncommon))' },
];

export interface SkillState {
  levels: Record<SkillId, number>;
  skillPoints: number;
  xp: number;
  level: number;
  // New stat system
  statPoints: number;
  stats: Record<StatId, number>;
  unlockedSkills: string[]; // skill node IDs
}

export interface GameState {
  player: Player;
  creatures: Creature[];
  projectiles: Projectile[];
  droppedItems: DroppedItem[];
  airBubbles: AirBubble[];
  particles: Particle[];
  camera: Vec2;
  worldWidth: number;
  worldHeight: number;
  terrain: number[];
  kelp: { x: number; height: number; phase: number }[];
  rocks: { x: number; y: number; size: number }[];
  time: number;
  score: number;
  gameOver: boolean;
  paused: boolean;
  showInventory: boolean;
  showSkillTree: boolean;
  skills: SkillState;
  depthZone: number; // 0-4
  boss: BossState;
  memoryFragments: MemoryFragment[];
  memoryCollected: { title: string; text: string } | null; // currently showing
}

export interface GameCallbacks {
  onStateUpdate: (state: GameState) => void;
  onItemPickup: (item: ItemDef, count: number) => void;
  onPlayerDeath: () => void;
  onCreatureKill: (name: string) => void;
  onMemoryFragment: (title: string, text: string) => void;
}

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#a0a0a0',
  uncommon: '#4ade80',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
};

export const ZONE_NAMES = ['The Shallows', 'The Kelp Forests', 'The Sunken Labs', 'The Abyssal Trenches', 'The Core'];
