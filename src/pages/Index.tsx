import { useState, useRef, useCallback, useEffect } from 'react';
import { Game } from '@/game/Game';
import { GameState, ItemDef, SkillId, StatId, MAX_SKILL_LEVEL, SKILLS, SKILL_NODES } from '@/game/types';
import GameCanvas from '@/components/game/GameCanvas';
import HUD from '@/components/game/HUD';
import Inventory from '@/components/game/Inventory';
import SkillTree from '@/components/game/SkillTree';
import TitleScreen from '@/components/game/TitleScreen';
import MemoryFragmentOverlay from '@/components/game/MemoryFragmentOverlay';
import { toast } from 'sonner';

export default function Index() {
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [memoryFragment, setMemoryFragment] = useState<{ title: string; text: string } | null>(null);
  const gameRef = useRef<Game | null>(null);

  const handleStateUpdate = useCallback((state: GameState) => {
    setGameState({ ...state });
  }, []);

  const handleItemPickup = useCallback((item: ItemDef, count: number) => {
    toast(`+${count} ${item.icon} ${item.name}`, {
      duration: 1500,
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: '9px',
        background: 'hsl(220, 45%, 10%)',
        border: '1px solid hsl(185, 80%, 50%, 0.3)',
        color: 'hsl(200, 20%, 85%)',
      },
    });
  }, []);

  const handleMemoryFragment = useCallback((title: string, text: string) => {
    setMemoryFragment({ title, text });
    if (gameRef.current) {
      gameRef.current.state.paused = true;
    }
  }, []);

  const handleCloseMemoryFragment = useCallback(() => {
    setMemoryFragment(null);
    if (gameRef.current) {
      gameRef.current.state.paused = false;
      gameRef.current.state.memoryCollected = null;
      setGameState({ ...gameRef.current.state });
    }
  }, []);

  const handleCloseInventory = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.state.showInventory = false;
      gameRef.current.state.paused = false;
      setGameState({ ...gameRef.current.state });
    }
  }, []);

  const handleCloseSkillTree = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.state.showSkillTree = false;
      gameRef.current.state.paused = false;
      setGameState({ ...gameRef.current.state });
    }
  }, []);

  const handleAllocateStat = useCallback((id: StatId) => {
    if (!gameRef.current) return;
    const s = gameRef.current.state.skills;
    if (s.statPoints <= 0) return;
    if ((s.stats[id] || 0) >= 20) return;
    s.stats[id] = (s.stats[id] || 0) + 1;
    s.statPoints--;
    toast(`⬆️ ${id} increased!`, {
      duration: 1200,
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: '9px',
        background: 'hsl(220, 45%, 10%)',
        border: '1px solid hsl(185, 80%, 50%, 0.3)',
        color: 'hsl(200, 20%, 85%)',
      },
    });
    setGameState({ ...gameRef.current.state });
  }, []);

  const handleUnlockSkill = useCallback((nodeId: string) => {
    if (!gameRef.current) return;
    const s = gameRef.current.state.skills;
    if (s.skillPoints <= 0 || s.unlockedSkills.includes(nodeId)) return;
    const node = SKILL_NODES.find(n => n.id === nodeId);
    if (!node) return;
    s.unlockedSkills.push(nodeId);
    s.skillPoints--;
    toast(`${node.icon} ${node.name} unlocked!`, {
      duration: 1500,
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: '9px',
        background: 'hsl(220, 45%, 10%)',
        border: `1px solid ${node.color}`,
        color: 'hsl(200, 20%, 85%)',
      },
    });
    setGameState({ ...gameRef.current.state });
  }, []);

  const handleMoveToQuickslot = useCallback((invIdx: number, qsIdx: number) => {
    gameRef.current?.moveInventoryToQuickslot(invIdx, qsIdx);
  }, []);

  const handleDrop = useCallback((invIdx: number) => {
    gameRef.current?.dropInventoryItem(invIdx);
  }, []);

  const handleCraft = useCallback((recipeId: string) => {
    if (!gameRef.current) return;
    gameRef.current.craftItem(recipeId);
    setGameState({ ...gameRef.current.state });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && gameState?.gameOver) {
        gameRef.current?.restart();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [gameState?.gameOver]);

  if (screen === 'title') {
    return <TitleScreen onStart={() => setScreen('game')} />;
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      <GameCanvas
        onStateUpdate={handleStateUpdate}
        onItemPickup={handleItemPickup}
        onMemoryFragment={handleMemoryFragment}
        gameRef={gameRef}
        running={screen === 'game'}
      />
      <HUD state={gameState} />
      {gameState?.showInventory && (
        <Inventory
          state={gameState}
          onClose={handleCloseInventory}
          onMoveToQuickslot={handleMoveToQuickslot}
          onDrop={handleDrop}
          onCraft={handleCraft}
        />
      )}
      {gameState?.showSkillTree && (
        <SkillTree
          state={gameState}
          onClose={handleCloseSkillTree}
          onAllocateStat={handleAllocateStat}
          onUnlockSkill={handleUnlockSkill}
        />
      )}
      {memoryFragment && (
        <MemoryFragmentOverlay
          title={memoryFragment.title}
          text={memoryFragment.text}
          onClose={handleCloseMemoryFragment}
        />
      )}
    </div>
  );
}
