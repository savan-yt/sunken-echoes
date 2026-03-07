import { ItemDef } from './types';
import { ITEMS } from './data';

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  icon: string;
  result: { itemId: string; count: number };
  ingredients: { itemId: string; count: number }[];
  category: 'weapon' | 'consumable' | 'gear';
}

// Add new craftable items to ITEMS
ITEMS.reinforced_harpoon = {
  id: 'reinforced_harpoon', name: 'Reinforced Harpoon', description: 'A sturdier harpoon. +50% damage.',
  rarity: 'uncommon', stackable: false, maxStack: 1, icon: '🔱', category: 'weapon',
};
ITEMS.venomous_harpoon = {
  id: 'venomous_harpoon', name: 'Venomous Harpoon', description: 'Coated in toxin. Deals poison damage.',
  rarity: 'rare', stackable: false, maxStack: 1, icon: '🔱', category: 'weapon',
};
ITEMS.abyssal_lance = {
  id: 'abyssal_lance', name: 'Abyssal Lance', description: 'Forged from the deep. Devastating power.',
  rarity: 'epic', stackable: false, maxStack: 1, icon: '⚡', category: 'weapon',
};
ITEMS.medkit = {
  id: 'medkit', name: 'Medkit', description: 'Restores 40 HP instantly.',
  rarity: 'uncommon', stackable: true, maxStack: 5, icon: '🩹', category: 'consumable',
};
ITEMS.pressure_suit = {
  id: 'pressure_suit', name: 'Pressure Suit', description: 'Reduces oxygen drain by 20%.',
  rarity: 'rare', stackable: false, maxStack: 1, icon: '🤿', category: 'gear',
};
ITEMS.bone_armor = {
  id: 'bone_armor', name: 'Bone Armor', description: 'Reduces damage taken by 15%.',
  rarity: 'uncommon', stackable: false, maxStack: 1, icon: '🦴', category: 'gear',
};
ITEMS.ink_bomb = {
  id: 'ink_bomb', name: 'Ink Bomb', description: 'Blinds nearby enemies for 3 seconds.',
  rarity: 'rare', stackable: true, maxStack: 3, icon: '💣', category: 'consumable',
};
ITEMS.bio_stim = {
  id: 'bio_stim', name: 'Bio-Stim', description: '+30% attack speed for 10 seconds.',
  rarity: 'rare', stackable: true, maxStack: 3, icon: '💉', category: 'consumable',
};

export const RECIPES: CraftingRecipe[] = [
  // Weapons
  {
    id: 'reinforced_harpoon', name: 'Reinforced Harpoon', icon: '🔱',
    description: 'Upgrade your harpoon with scrap metal and bone.',
    result: { itemId: 'reinforced_harpoon', count: 1 },
    ingredients: [
      { itemId: 'scrap_metal', count: 4 },
      { itemId: 'bone_shards', count: 6 },
    ],
    category: 'weapon',
  },
  {
    id: 'venomous_harpoon', name: 'Venomous Harpoon', icon: '🔱',
    description: 'A harpoon coated in toxic gland secretions.',
    result: { itemId: 'venomous_harpoon', count: 1 },
    ingredients: [
      { itemId: 'scrap_metal', count: 3 },
      { itemId: 'toxic_gland', count: 2 },
      { itemId: 'rotted_skin', count: 2 },
    ],
    category: 'weapon',
  },
  {
    id: 'abyssal_lance', name: 'Abyssal Lance', icon: '⚡',
    description: 'The ultimate weapon, forged from abyssal crystals.',
    result: { itemId: 'abyssal_lance', count: 1 },
    ingredients: [
      { itemId: 'deep_crystal', count: 3 },
      { itemId: 'void_essence', count: 2 },
      { itemId: 'bio_cell', count: 2 },
    ],
    category: 'weapon',
  },
  // Consumables
  {
    id: 'medkit', name: 'Medkit', icon: '🩹',
    description: 'Patch yourself up with organic materials.',
    result: { itemId: 'medkit', count: 1 },
    ingredients: [
      { itemId: 'mutant_flesh', count: 3 },
      { itemId: 'kelp_fiber', count: 4 },
    ],
    category: 'consumable',
  },
  {
    id: 'oxygen_canister', name: 'Oxygen Canister', icon: '🫧',
    description: 'Craft a portable oxygen supply.',
    result: { itemId: 'oxygen_canister', count: 1 },
    ingredients: [
      { itemId: 'scrap_metal', count: 2 },
      { itemId: 'kelp_fiber', count: 3 },
    ],
    category: 'consumable',
  },
  {
    id: 'ink_bomb', name: 'Ink Bomb', icon: '💣',
    description: 'Create a blinding ink grenade.',
    result: { itemId: 'ink_bomb', count: 1 },
    ingredients: [
      { itemId: 'ink_sac', count: 2 },
      { itemId: 'scrap_metal', count: 1 },
    ],
    category: 'consumable',
  },
  {
    id: 'bio_stim', name: 'Bio-Stim', icon: '💉',
    description: 'Inject bio-cell energy for a combat boost.',
    result: { itemId: 'bio_stim', count: 1 },
    ingredients: [
      { itemId: 'bio_cell', count: 1 },
      { itemId: 'mutant_flesh', count: 2 },
    ],
    category: 'consumable',
  },
  {
    id: 'antitoxin', name: 'Antitoxin Vial', icon: '🧪',
    description: 'Neutralize toxins with extracted glands.',
    result: { itemId: 'antitoxin', count: 1 },
    ingredients: [
      { itemId: 'toxic_gland', count: 1 },
      { itemId: 'kelp_fiber', count: 2 },
    ],
    category: 'consumable',
  },
  // Gear
  {
    id: 'bone_armor', name: 'Bone Armor', icon: '🦴',
    description: 'Craft protective armor from creature bones.',
    result: { itemId: 'bone_armor', count: 1 },
    ingredients: [
      { itemId: 'bone_shards', count: 8 },
      { itemId: 'rotted_skin', count: 3 },
      { itemId: 'scrap_metal', count: 2 },
    ],
    category: 'gear',
  },
  {
    id: 'pressure_suit', name: 'Pressure Suit', icon: '🤿',
    description: 'Build a suit to withstand deep pressure.',
    result: { itemId: 'pressure_suit', count: 1 },
    ingredients: [
      { itemId: 'rotted_skin', count: 4 },
      { itemId: 'deep_crystal', count: 2 },
      { itemId: 'scrap_metal', count: 3 },
    ],
    category: 'gear',
  },
];

export function canCraft(recipe: CraftingRecipe, inventory: ({ item: ItemDef; count: number } | null)[]): boolean {
  return recipe.ingredients.every(ing => {
    const total = inventory.reduce((sum, slot) => {
      if (slot && slot.item.id === ing.itemId) return sum + slot.count;
      return sum;
    }, 0);
    return total >= ing.count;
  });
}

export function getIngredientCount(itemId: string, inventory: ({ item: ItemDef; count: number } | null)[]): number {
  return inventory.reduce((sum, slot) => {
    if (slot && slot.item.id === itemId) return sum + slot.count;
    return sum;
  }, 0);
}
