export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  stackable: boolean;
  maxStack: number;
  icon: string; // emoji for now
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
  facing: number; // -1 or 1
  oxygen: number;
  maxOxygen: number;
  hp: number;
  maxHp: number;
  shootCooldown: number;
  invincible: number;
  inventory: (InventorySlot | null)[];
  quickslots: (InventorySlot | null)[];
  activeQuickslot: number;
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
}

export interface LootEntry {
  itemId: string;
  chance: number; // 0-1
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
  type: 'bubble' | 'glow' | 'damage' | 'pickup';
}

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

export const MAX_SKILL_LEVEL = 5;
export const XP_PER_LEVEL = 100;

export interface SkillState {
  levels: Record<SkillId, number>;
  skillPoints: number;
  xp: number;
  level: number;
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
}

export interface GameCallbacks {
  onStateUpdate: (state: GameState) => void;
  onItemPickup: (item: ItemDef, count: number) => void;
  onPlayerDeath: () => void;
  onCreatureKill: (name: string) => void;
}

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#a0a0a0',
  uncommon: '#4ade80',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
};
