import { ItemDef, LootEntry, NPCDef } from './types';

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
  memory_fragment_1: {
    id: 'memory_fragment_1', name: 'Memory Fragment: The Breach', description: 'A data crystal containing fragmented research logs.',
    rarity: 'legendary', stackable: false, maxStack: 1, icon: '🧠', category: 'material',
  },
  // === NEW ZONE 2 ITEMS ===
  angler_lure: {
    id: 'angler_lure', name: 'Angler Lure', description: 'A bioluminescent organ. Glows faintly.',
    rarity: 'uncommon', stackable: true, maxStack: 10, icon: '💡', category: 'material',
  },
  snake_scale: {
    id: 'snake_scale', name: 'Serpent Scale', description: 'Iridescent scale from a corrupted sea snake.',
    rarity: 'uncommon', stackable: true, maxStack: 15, icon: '🐍', category: 'material',
  },
  mantis_chitin: {
    id: 'mantis_chitin', name: 'Mantis Chitin', description: 'Impossibly hard shell fragment.',
    rarity: 'rare', stackable: true, maxStack: 5, icon: '🦐', category: 'material',
  },
  squid_beak: {
    id: 'squid_beak', name: 'Squid Beak', description: 'A sharp keratin beak from a corrupted squid.',
    rarity: 'uncommon', stackable: true, maxStack: 10, icon: '🦑', category: 'material',
  },
  kelp_membrane: {
    id: 'kelp_membrane', name: 'Kelp Membrane', description: 'Living tissue fused from corrupted kelp.',
    rarity: 'rare', stackable: true, maxStack: 5, icon: '🌱', category: 'material',
  },
  tangle_tentacle: {
    id: 'tangle_tentacle', name: 'Tangle Tentacle', description: 'A massive hooked tentacle from The Tangle.',
    rarity: 'epic', stackable: true, maxStack: 3, icon: '🐙', category: 'material',
  },
  // === NEW ZONE 3 ITEMS ===
  lab_circuit: {
    id: 'lab_circuit', name: 'Lab Circuit', description: 'A salvaged circuit board from the sunken labs.',
    rarity: 'uncommon', stackable: true, maxStack: 10, icon: '🔌', category: 'material',
  },
  drone_core: {
    id: 'drone_core', name: 'Drone Core', description: 'Power core from a security drone.',
    rarity: 'rare', stackable: true, maxStack: 5, icon: '🤖', category: 'material',
  },
  diver_tag: {
    id: 'diver_tag', name: 'Diver ID Tag', description: 'A corroded ID tag. Name barely legible.',
    rarity: 'uncommon', stackable: true, maxStack: 10, icon: '🏷️', category: 'material',
  },
  specimen_fluid: {
    id: 'specimen_fluid', name: 'Specimen Fluid', description: 'Unstable mutagen from a lab specimen.',
    rarity: 'rare', stackable: true, maxStack: 5, icon: '🧫', category: 'material',
  },
  overflow_residue: {
    id: 'overflow_residue', name: 'Overflow Residue', description: 'Liquid corruption in solid form.',
    rarity: 'epic', stackable: true, maxStack: 3, icon: '💧', category: 'material',
  },
  zero_core: {
    id: 'zero_core', name: 'Zero Core', description: 'The pulsing heart of Subject Zero. Still warm.',
    rarity: 'legendary', stackable: false, maxStack: 1, icon: '🫀', category: 'material',
  },
};

export const BOSS_TEMPLATES = {
  rotjaw: {
    name: 'Rotjaw, The Corrupted',
    hp: 300, damage: 25, speed: 70, behavior: 'chase' as const,
    attackRange: 35, patrolRange: 200, width: 52, height: 28, spriteType: 'rotjaw',
    xpValue: 200,
    isBoss: true,
    memoryFragment: {
      title: 'Memory Fragment: The Breach',
      text: 'Day 47 — The containment field collapsed at 03:00. Something came through from the deep trench... not a creature we catalogued. It moved wrong. The water around it turned black. Dr. Vasquez screamed that it was "learning" before the lights went out. When power returned, half the lab was flooded with corruption. Vasquez was gone. Only her badge remained, fused into the wall.',
    },
    lootTable: [
      { itemId: 'mutant_teeth', chance: 1.0, minCount: 4, maxCount: 6 },
      { itemId: 'corrupted_heart', chance: 0.5, minCount: 1, maxCount: 1 },
      { itemId: 'void_essence', chance: 0.4, minCount: 1, maxCount: 2 },
      { itemId: 'deep_crystal', chance: 0.6, minCount: 2, maxCount: 3 },
      { itemId: 'toxic_gland', chance: 0.8, minCount: 2, maxCount: 3 },
    ] as LootEntry[],
  },
  the_tangle: {
    name: 'The Tangle',
    hp: 450, damage: 20, speed: 30, behavior: 'ambush' as const,
    attackRange: 60, patrolRange: 100, width: 60, height: 60, spriteType: 'tangle',
    xpValue: 350,
    isBoss: true,
    memoryFragment: {
      title: 'Memory Fragment: The Laboratory',
      text: 'I remember a laboratory. Bright lights. Someone telling me not to look at the tank. But I did. The thing inside had too many eyes — twelve, clustered like grapes. It pressed against the glass. I could feel it thinking. The glass cracked. Not from pressure. It just... decided the glass should break.',
    },
    lootTable: [
      { itemId: 'tangle_tentacle', chance: 1.0, minCount: 2, maxCount: 4 },
      { itemId: 'ink_sac', chance: 1.0, minCount: 3, maxCount: 5 },
      { itemId: 'corrupted_heart', chance: 0.6, minCount: 1, maxCount: 1 },
      { itemId: 'kelp_membrane', chance: 0.8, minCount: 2, maxCount: 3 },
      { itemId: 'void_essence', chance: 0.5, minCount: 1, maxCount: 2 },
    ] as LootEntry[],
  },
  subject_zero: {
    name: 'Subject Zero',
    hp: 550, damage: 30, speed: 65, behavior: 'chase' as const,
    attackRange: 40, patrolRange: 150, width: 36, height: 40, spriteType: 'subject_zero',
    xpValue: 500,
    isBoss: true,
    memoryFragment: {
      title: 'Memory Fragment: The Consent',
      text: 'I remember signing something. A form. My hand was shaking. Someone said it would be fine. I believed them. The pen felt heavy. The fluorescent light hummed. Dr. Hess smiled but his eyes didn\'t. The clipboard had my name. My real name. I can almost see it now but the ink runs like water and the letters dissolve.',
    },
    lootTable: [
      { itemId: 'zero_core', chance: 1.0, minCount: 1, maxCount: 1 },
      { itemId: 'specimen_fluid', chance: 1.0, minCount: 3, maxCount: 5 },
      { itemId: 'corrupted_heart', chance: 0.7, minCount: 1, maxCount: 1 },
      { itemId: 'drone_core', chance: 0.6, minCount: 1, maxCount: 2 },
      { itemId: 'void_essence', chance: 0.8, minCount: 2, maxCount: 3 },
    ] as LootEntry[],
  },
};

export const CREATURE_TEMPLATES = {
  // ===== ZONE 1: THE SHALLOWS =====
  corrupted_clownfish: {
    name: 'Corrupted Clownfish',
    hp: 10, damage: 4, speed: 50, behavior: 'patrol' as const,
    attackRange: 20, patrolRange: 60, width: 16, height: 10, spriteType: 'clownfish',
    xpValue: 6, zone: 0,
    lootTable: [
      { itemId: 'mutant_flesh', chance: 0.5, minCount: 1, maxCount: 1 },
      { itemId: 'bone_shards', chance: 0.3, minCount: 1, maxCount: 2 },
    ] as LootEntry[],
  },
  corrupted_fish: {
    name: 'Corrupted Fish',
    hp: 15, damage: 5, speed: 40, behavior: 'patrol' as const,
    attackRange: 25, patrolRange: 80, width: 22, height: 14, spriteType: 'fish',
    xpValue: 10, zone: 0,
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
    xpValue: 22, zone: 0,
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
    xpValue: 15, zone: 0,
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
    xpValue: 35, zone: 0,
    lootTable: [
      { itemId: 'scrap_metal', chance: 0.4, minCount: 1, maxCount: 2 },
      { itemId: 'mutant_teeth', chance: 0.25, minCount: 1, maxCount: 2 },
      { itemId: 'deep_crystal', chance: 0.08, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
  corrupted_shark: {
    name: 'Rotjaw',
    hp: 80, damage: 20, speed: 60, behavior: 'chase' as const,
    attackRange: 28, patrolRange: 150, width: 40, height: 20, spriteType: 'shark',
    xpValue: 50, zone: 0,
    lootTable: [
      { itemId: 'mutant_teeth', chance: 0.6, minCount: 2, maxCount: 4 },
      { itemId: 'mutant_flesh', chance: 0.8, minCount: 2, maxCount: 3 },
      { itemId: 'toxic_gland', chance: 0.2, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },

  // ===== ZONE 2: THE KELP FORESTS =====
  corrupted_anglerfish: {
    name: 'Corrupted Anglerfish',
    hp: 35, damage: 18, speed: 30, behavior: 'ambush' as const,
    attackRange: 30, patrolRange: 50, width: 28, height: 20, spriteType: 'anglerfish',
    xpValue: 30, zone: 1,
    lootTable: [
      { itemId: 'angler_lure', chance: 0.5, minCount: 1, maxCount: 1 },
      { itemId: 'mutant_flesh', chance: 0.6, minCount: 1, maxCount: 3 },
      { itemId: 'bio_cell', chance: 0.15, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
  corrupted_sea_snake: {
    name: 'Corrupted Sea Snake',
    hp: 30, damage: 12, speed: 70, behavior: 'chase' as const,
    attackRange: 22, patrolRange: 100, width: 36, height: 8, spriteType: 'sea_snake',
    xpValue: 25, zone: 1,
    lootTable: [
      { itemId: 'snake_scale', chance: 0.4, minCount: 1, maxCount: 2 },
      { itemId: 'toxic_gland', chance: 0.15, minCount: 1, maxCount: 1 },
      { itemId: 'mutant_flesh', chance: 0.5, minCount: 1, maxCount: 2 },
    ] as LootEntry[],
  },
  corrupted_mantis_shrimp: {
    name: 'Corrupted Mantis Shrimp',
    hp: 60, damage: 30, speed: 20, behavior: 'ambush' as const,
    attackRange: 25, patrolRange: 30, width: 22, height: 14, spriteType: 'mantis_shrimp',
    xpValue: 45, zone: 1,
    lootTable: [
      { itemId: 'mantis_chitin', chance: 0.35, minCount: 1, maxCount: 1 },
      { itemId: 'bone_shards', chance: 0.6, minCount: 2, maxCount: 4 },
      { itemId: 'scrap_metal', chance: 0.3, minCount: 1, maxCount: 2 },
    ] as LootEntry[],
  },
  corrupted_squid: {
    name: 'Corrupted Squid',
    hp: 25, damage: 10, speed: 45, behavior: 'chase' as const,
    attackRange: 35, patrolRange: 90, width: 24, height: 26, spriteType: 'squid',
    rangedAttack: 'ink',
    xpValue: 28, zone: 1,
    lootTable: [
      { itemId: 'ink_sac', chance: 0.5, minCount: 1, maxCount: 2 },
      { itemId: 'squid_beak', chance: 0.3, minCount: 1, maxCount: 1 },
      { itemId: 'kelp_fiber', chance: 0.4, minCount: 1, maxCount: 3 },
    ] as LootEntry[],
  },
  kelp_lurker: {
    name: 'Kelp Lurker',
    hp: 45, damage: 15, speed: 15, behavior: 'ambush' as const,
    attackRange: 28, patrolRange: 20, width: 20, height: 30, spriteType: 'kelp_lurker',
    xpValue: 40, zone: 1,
    lootTable: [
      { itemId: 'kelp_membrane', chance: 0.25, minCount: 1, maxCount: 1 },
      { itemId: 'kelp_fiber', chance: 0.7, minCount: 2, maxCount: 4 },
      { itemId: 'toxic_gland', chance: 0.1, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },

  // ===== ZONE 3: THE SUNKEN LABS =====
  corrupted_lab_rat: {
    name: 'Corrupted Lab Rat',
    hp: 8, damage: 3, speed: 60, behavior: 'chase' as const,
    attackRange: 15, patrolRange: 60, width: 12, height: 8, spriteType: 'lab_rat',
    xpValue: 5, zone: 2,
    lootTable: [
      { itemId: 'mutant_flesh', chance: 0.4, minCount: 1, maxCount: 1 },
      { itemId: 'bone_shards', chance: 0.3, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
  corrupted_specimen: {
    name: 'Corrupted Specimen',
    hp: 50, damage: 18, speed: 40, behavior: 'chase' as const,
    attackRange: 25, patrolRange: 80, width: 26, height: 24, spriteType: 'specimen',
    rangedAttack: 'acid',
    xpValue: 40, zone: 2,
    lootTable: [
      { itemId: 'specimen_fluid', chance: 0.3, minCount: 1, maxCount: 1 },
      { itemId: 'mutant_flesh', chance: 0.6, minCount: 1, maxCount: 3 },
      { itemId: 'toxic_gland', chance: 0.2, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
  security_drone: {
    name: 'Security Drone',
    hp: 40, damage: 14, speed: 35, behavior: 'patrol' as const,
    attackRange: 40, patrolRange: 100, width: 20, height: 18, spriteType: 'drone',
    rangedAttack: 'laser',
    xpValue: 35, zone: 2,
    lootTable: [
      { itemId: 'drone_core', chance: 0.25, minCount: 1, maxCount: 1 },
      { itemId: 'scrap_metal', chance: 0.7, minCount: 1, maxCount: 3 },
      { itemId: 'lab_circuit', chance: 0.4, minCount: 1, maxCount: 2 },
    ] as LootEntry[],
  },
  corrupted_diver: {
    name: 'Corrupted Diver',
    hp: 55, damage: 16, speed: 50, behavior: 'chase' as const,
    attackRange: 25, patrolRange: 100, width: 16, height: 26, spriteType: 'corrupted_diver',
    xpValue: 45, zone: 2,
    lootTable: [
      { itemId: 'diver_tag', chance: 0.4, minCount: 1, maxCount: 1 },
      { itemId: 'scrap_metal', chance: 0.5, minCount: 1, maxCount: 2 },
      { itemId: 'lab_circuit', chance: 0.2, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
  the_overflow: {
    name: 'The Overflow',
    hp: 35, damage: 10, speed: 25, behavior: 'ambush' as const,
    attackRange: 30, patrolRange: 40, width: 24, height: 12, spriteType: 'overflow',
    rangedAttack: 'acid',
    xpValue: 38, zone: 2,
    lootTable: [
      { itemId: 'overflow_residue', chance: 0.2, minCount: 1, maxCount: 1 },
      { itemId: 'specimen_fluid', chance: 0.35, minCount: 1, maxCount: 1 },
      { itemId: 'toxic_gland', chance: 0.3, minCount: 1, maxCount: 1 },
    ] as LootEntry[],
  },
};

// Zone-grouped creature keys for spawning
export const ZONE_CREATURES: Record<number, string[]> = {
  0: ['corrupted_clownfish', 'corrupted_fish', 'corrupted_eel', 'jelly_drifter', 'abyssal_crab', 'corrupted_shark'],
  1: ['corrupted_anglerfish', 'corrupted_sea_snake', 'corrupted_mantis_shrimp', 'corrupted_squid', 'kelp_lurker'],
  2: ['corrupted_lab_rat', 'corrupted_specimen', 'security_drone', 'corrupted_diver', 'the_overflow'],
  3: ['corrupted_fish', 'corrupted_eel', 'corrupted_shark', 'abyssal_crab'], // abyss reuses some
  4: ['corrupted_shark', 'abyssal_crab', 'corrupted_specimen'], // core has toughest
};
