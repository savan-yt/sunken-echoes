import { useRef, useEffect, useCallback } from 'react';
import { Game } from '@/game/Game';
import { GameState, ItemDef } from '@/game/types';

interface GameCanvasProps {
  onStateUpdate: (state: GameState) => void;
  onItemPickup: (item: ItemDef, count: number) => void;
  gameRef: React.MutableRefObject<Game | null>;
  running: boolean;
}

export default function GameCanvas({ onStateUpdate, onItemPickup, gameRef, running }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handlePlayerDeath = useCallback(() => {
    onStateUpdate(gameRef.current!.state);
  }, [gameRef, onStateUpdate]);

  const handleCreatureKill = useCallback((_name: string) => {
    // Could show kill notification
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !running) return;

    const game = new Game(canvasRef.current, {
      onStateUpdate,
      onItemPickup,
      onPlayerDeath: handlePlayerDeath,
      onCreatureKill: handleCreatureKill,
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
