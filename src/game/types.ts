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
