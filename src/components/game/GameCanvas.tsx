import { useRef, useEffect, useCallback } from 'react';
import { Game } from '@/game/Game';
import { GameState, ItemDef } from '@/game/types';

interface GameCanvasProps {
  onStateUpdate: (state: GameState) => void;
  onItemPickup: (item: ItemDef, count: number) => void;
  onMemoryFragment: (title: string, text: string) => void;
  gameRef: React.MutableRefObject<Game | null>;
  running: boolean;
}

export default function GameCanvas({ onStateUpdate, onItemPickup, onMemoryFragment, gameRef, running }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handlePlayerDeath = useCallback(() => {
    onStateUpdate(gameRef.current!.state);
  }, [gameRef, onStateUpdate]);

  const handleCreatureKill = useCallback((_name: string) => {}, []);

  useEffect(() => {
    if (!canvasRef.current || !running) return;

    const game = new Game(canvasRef.current, {
      onStateUpdate,
      onItemPickup,
      onPlayerDeath: handlePlayerDeath,
      onCreatureKill: handleCreatureKill,
      onMemoryFragment,
    });
    gameRef.current = game;
    game.start();

    return () => {
      game.stop();
    };
  }, [running]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ imageRendering: 'pixelated', cursor: 'crosshair' }}
    />
  );
}
