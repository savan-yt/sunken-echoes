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
    attackRange: 20, patrolRange: 80, width: 14, height: 8, spriteType: 'fish',
    lootTable: [
      { itemId: 'mutant_flesh', chance: 0.6, minCount: 1, maxCount: 2 },
      { itemId: 'bone_shards', chance: 0.4, minCount: 1, maxCount: 3 },
    ] as LootEntry[],
  },
  corrupted_eel: {
    name: 'Corrupted Eel',
    hp: 25, damage: 8, speed: 55, behavior: 'chase' as const,
    attackRange: 18, patrolRange: 120, width: 20, height: 6, spriteType: 'eel',
    rangedAttack: 'acid',
    lootTable: [
      { itemId: 'rotted_skin', chance: 0.35, minCount: 1, maxCount: 1 },
      { itemId: 'mutant_flesh', chance: 0.5, minCount: 1, maxCount: 2 },
      { itemId: 'toxic_gland', chance: 0.1, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
  jelly_drifter: {
    name: 'Jelly Drifter',
    hp: 10, damage: 12, speed: 20, behavior: 'patrol' as const,
    attackRange: 25, patrolRange: 60, width: 12, height: 14, spriteType: 'jelly',
    rangedAttack: 'shock',
    lootTable: [
      { itemId: 'bio_cell', chance: 0.15, minCount: 1, maxCount: 1 },
      { itemId: 'kelp_fiber', chance: 0.5, minCount: 1, maxCount: 2 },
      { itemId: 'ink_sac', chance: 0.2, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
  abyssal_crab: {
    name: 'Abyssal Crab',
    hp: 40, damage: 15, speed: 25, behavior: 'ambush' as const,
    attackRange: 15, patrolRange: 40, width: 16, height: 10, spriteType: 'crab',
    lootTable: [
      { itemId: 'scrap_metal', chance: 0.4, minCount: 1, maxCount: 2 },
      { itemId: 'mutant_teeth', chance: 0.25, minCount: 1, maxCount: 2 },
      { itemId: 'deep_crystal', chance: 0.08, minCount: 1, maxCount: 1 },
      { itemId: 'void_essence', chance: 0.03, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
};
