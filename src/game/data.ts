import { ItemDef, LootEntry } from './types';

export const ITEMS: Record<string, ItemDef> = {
  rusty_harpoon: {
    id: 'rusty_harpoon', name: 'Rusty Harpoon', description: 'A weathered harpoon. Still sharp enough.',
    rarity: 'common', stackable: false, maxStack: 1, icon: '🔱', category: 'weapon',
  },
  mutant_flesh: {
    id: 'mutant_flesh', name: 'Mutant Flesh', description: 'Twisted organic matter from corrupted creatures.',
    rarity: 'common', stackable: true, maxStack: 20, icon: '🥩', category: 'material',
  },
  bone_shards: {
    id: 'bone_shards', name: 'Bone Shards', description: 'Calcified fragments. Useful for crafting.',
    rarity: 'common', stackable: true, maxStack: 30, icon: '🦴', category: 'material',
  },
  scrap_metal: {
    id: 'scrap_metal', name: 'Scrap Metal', description: 'Corroded metal salvage from the deep.',
    rarity: 'common', stackable: true, maxStack: 20, icon: '⚙️', category: 'material',
  },
  kelp_fiber: {
    id: 'kelp_fiber', name: 'Kelp Fiber', description: 'Tough strands harvested from deep kelp.',
    rarity: 'common', stackable: true, maxStack: 30, icon: '🌿', category: 'material',
  },
  rotted_skin: {
    id: 'rotted_skin', name: 'Rotted Skin', description: 'Acid-resistant hide from corrupted eels.',
    rarity: 'uncommon', stackable: true, maxStack: 15, icon: '🧬', category: 'material',
  },
  mutant_teeth: {
    id: 'mutant_teeth', name: 'Mutant Teeth', description: 'Razor-sharp teeth from jaw creatures.',
    rarity: 'uncommon', stackable: true, maxStack: 15, icon: '🦷', category: 'material',
  },
  ink_sac: {
    id: 'ink_sac', name: 'Ink Sac', description: 'Dark ink from cephalopods. Used for decoys.',
    rarity: 'uncommon', stackable: true, maxStack: 10, icon: '🖤', category: 'material',
  },
  toxic_gland: {
    id: 'toxic_gland', name: 'Toxic Gland', description: 'Venomous organ. Handle with care.',
    rarity: 'rare', stackable: true, maxStack: 5, icon: '☠️', category: 'material',
  },
  bio_cell: {
    id: 'bio_cell', name: 'Bio-Cell', description: 'Electric energy source from jellyfish.',
    rarity: 'rare', stackable: true, maxStack: 5, icon: '⚡', category: 'material',
  },
  deep_crystal: {
    id: 'deep_crystal', name: 'Deep Crystal', description: 'Gleaming crystal from the abyssal zone.',
    rarity: 'rare', stackable: true, maxStack: 5, icon: '💎', category: 'material',
  },
  void_essence: {
    id: 'void_essence', name: 'Void Essence', description: 'Darkness given form. Radiates cold.',
    rarity: 'epic', stackable: true, maxStack: 3, icon: '🌑', category: 'material',
  },
  corrupted_heart: {
    id: 'corrupted_heart', name: 'Corrupted Heart', description: 'Still beating. Pulses with dark energy.',
    rarity: 'legendary', stackable: false, maxStack: 1, icon: '💜', category: 'material',
  },
  oxygen_canister: {
    id: 'oxygen_canister', name: 'Oxygen Canister', description: 'Restores 30% oxygen when used.',
    rarity: 'uncommon', stackable: true, maxStack: 5, icon: '🫧', category: 'consumable',
  },
  antitoxin: {
    id: 'antitoxin', name: 'Antitoxin Vial', description: 'Cures poison and restores health.',
    rarity: 'uncommon', stackable: true, maxStack: 5, icon: '🧪', category: 'consumable',
  },
};

export const CREATURE_TEMPLATES = {
  corrupted_fish: {
    name: 'Corrupted Fish',
    hp: 15, damage: 5, speed: 40, behavior: 'patrol' as const,
    attackRange: 25, patrolRange: 80, width: 22, height: 14, spriteType: 'fish',
    xpValue: 10,
    lootTable: [
      { itemId: 'mutant_flesh', chance: 0.6, minCount: 1, maxCount: 2 },
      { itemId: 'bone_shards', chance: 0.4, minCount: 1, maxCount: 3 },
    ] as LootEntry[],
  },
  corrupted_eel: {
    name: 'Corrupted Eel',
    hp: 25, damage: 8, speed: 55, behavior: 'chase' as const,
    attackRange: 22, patrolRange: 120, width: 32, height: 10, spriteType: 'eel',
    rangedAttack: 'acid',
    xpValue: 22,
    lootTable: [
      { itemId: 'rotted_skin', chance: 0.35, minCount: 1, maxCount: 1 },
      { itemId: 'mutant_flesh', chance: 0.5, minCount: 1, maxCount: 2 },
      { itemId: 'toxic_gland', chance: 0.1, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
  jelly_drifter: {
    name: 'Jelly Drifter',
    hp: 10, damage: 12, speed: 20, behavior: 'patrol' as const,
    attackRange: 30, patrolRange: 60, width: 18, height: 22, spriteType: 'jelly',
    rangedAttack: 'shock',
    xpValue: 15,
    lootTable: [
      { itemId: 'bio_cell', chance: 0.15, minCount: 1, maxCount: 1 },
      { itemId: 'kelp_fiber', chance: 0.5, minCount: 1, maxCount: 2 },
      { itemId: 'ink_sac', chance: 0.2, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
  abyssal_crab: {
    name: 'Abyssal Crab',
    hp: 40, damage: 15, speed: 25, behavior: 'ambush' as const,
    attackRange: 20, patrolRange: 40, width: 24, height: 16, spriteType: 'crab',
    xpValue: 35,
    lootTable: [
      { itemId: 'scrap_metal', chance: 0.4, minCount: 1, maxCount: 2 },
      { itemId: 'mutant_teeth', chance: 0.25, minCount: 1, maxCount: 2 },
      { itemId: 'deep_crystal', chance: 0.08, minCount: 1, maxCount: 1 },
      { itemId: 'void_essence', chance: 0.03, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
  corrupted_shark: {
    name: 'Rotjaw',
    hp: 80, damage: 20, speed: 60, behavior: 'chase' as const,
    attackRange: 28, patrolRange: 150, width: 40, height: 20, spriteType: 'shark',
    xpValue: 50,
    lootTable: [
      { itemId: 'mutant_teeth', chance: 0.6, minCount: 2, maxCount: 4 },
      { itemId: 'mutant_flesh', chance: 0.8, minCount: 2, maxCount: 3 },
      { itemId: 'toxic_gland', chance: 0.2, minCount: 1, maxCount: 1 },
      { itemId: 'corrupted_heart', chance: 0.02, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
};
