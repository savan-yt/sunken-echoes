import { GameState } from '@/game/types';

interface MinimapProps {
  state: GameState | null;
}

const MAP_W = 200;
const MAP_H = 70;

export default function Minimap({ state }: MinimapProps) {
  if (!state) return null;

  const { player, creatures, airBubbles, droppedItems, worldWidth, worldHeight, boss, npcs } = state;

  const toMapX = (x: number) => (x / worldWidth) * MAP_W;
  const toMapY = (y: number) => (y / worldHeight) * MAP_H;

  const px = toMapX(player.pos.x);
  const py = toMapY(player.pos.y);

  const viewW = toMapX(780);
  const viewH = toMapY(440);

  // Zone boundaries
  const zoneW = MAP_W / 5;

  return (
    <div
      className="pixel-border"
      style={{
        width: MAP_W + 4,
        height: MAP_H + 18,
        backgroundColor: 'hsla(220, 50%, 6%, 0.85)',
        borderColor: 'hsl(185, 60%, 30%)',
        padding: 2,
        fontFamily: '"Press Start 2P", cursive',
      }}
    >
      <div className="text-[5px] text-center mb-0.5" style={{ color: 'hsl(185, 80%, 50%)' }}>
        MAP
      </div>
      <svg
        width={MAP_W}
        height={MAP_H}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="depthGrad" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="hsl(260, 30%, 5%)" />
            <stop offset="30%" stopColor="hsl(240, 40%, 8%)" />
            <stop offset="60%" stopColor="hsl(210, 50%, 10%)" />
            <stop offset="100%" stopColor="hsl(200, 60%, 15%)" />
          </linearGradient>
        </defs>
        <rect width={MAP_W} height={MAP_H} fill="url(#depthGrad)" rx="1" />

        {/* Zone dividers */}
        {[1, 2, 3, 4].map(i => (
          <line
            key={`z${i}`}
            x1={zoneW * i} y1={0} x2={zoneW * i} y2={MAP_H}
            stroke="hsl(185, 40%, 25%)" strokeWidth="0.5" strokeDasharray="2,2"
          />
        ))}

        {/* Terrain silhouette */}
        <polyline
          points={Array.from({ length: Math.floor(MAP_W) }, (_, i) => {
            const worldX = Math.floor((i / MAP_W) * worldWidth);
            const terrainIdx = Math.min(worldX, state.terrain.length - 1);
            const ty = toMapY(state.terrain[terrainIdx]);
            return `${i},${ty}`;
          }).join(' ')}
          fill="none"
          stroke="hsl(30, 20%, 25%)"
          strokeWidth="0.8"
        />

        {/* Camera view rectangle */}
        <rect
          x={toMapX(state.camera.x)}
          y={toMapY(state.camera.y)}
          width={viewW}
          height={viewH}
          fill="none"
          stroke="hsl(185, 60%, 40%)"
          strokeWidth="0.5"
          strokeDasharray="2,1"
          opacity={0.6}
        />

        {/* Air bubbles */}
        {airBubbles.filter(b => b.active).map((b, i) => (
          <circle key={`b${i}`} cx={toMapX(b.pos.x)} cy={toMapY(b.pos.y)} r={1.5}
            fill="hsl(195, 90%, 60%)" opacity={0.7}
          />
        ))}

        {/* Dropped items */}
        {droppedItems.map((d, i) => (
          <rect key={`d${i}`} x={toMapX(d.pos.x) - 0.5} y={toMapY(d.pos.y) - 0.5}
            width={1} height={1} fill="hsl(45, 90%, 60%)" opacity={0.7}
          />
        ))}

        {/* Regular creatures */}
        {creatures.filter(c => c.state !== 'dead' && !c.id.startsWith('boss_')).map((c, i) => (
          <circle key={`c${i}`} cx={toMapX(c.pos.x)} cy={toMapY(c.pos.y)} r={1.2}
            fill="hsl(0, 60%, 50%)" opacity={0.8}
          />
        ))}

        {/* Boss creatures — always shown with skull icon */}
        {creatures.filter(c => c.state !== 'dead' && c.id.startsWith('boss_')).map((c, i) => {
          const bx = toMapX(c.pos.x);
          const by = toMapY(c.pos.y);
          const isActive = boss.active && c.id === boss.creatureId;
          return (
            <g key={`boss${i}`}>
              {/* Pulsing glow ring */}
              <circle cx={bx} cy={by} r={4} fill="none"
                stroke={isActive ? 'hsl(0, 80%, 55%)' : 'hsl(0, 60%, 40%)'}
                strokeWidth="0.6" opacity={0.5}
              />
              {/* Boss dot */}
              <circle cx={bx} cy={by} r={2.5}
                fill={isActive ? 'hsl(0, 80%, 55%)' : 'hsl(0, 60%, 45%)'}
              />
              {/* Skull symbol */}
              <text x={bx} y={by + 1.5} textAnchor="middle" fontSize="4"
                fill="white" opacity={0.9}>
                💀
              </text>
            </g>
          );
        })}

        {/* NPCs — shown as colored diamonds */}
        {npcs.map((npc, i) => {
          const nx = toMapX(npc.pos.x);
          const ny = toMapY(npc.pos.y);
          return (
            <g key={`npc${i}`}>
              <polygon
                points={`${nx},${ny - 3} ${nx + 2},${ny} ${nx},${ny + 3} ${nx - 2},${ny}`}
                fill={npc.def.color}
                opacity={0.9}
              />
              <polygon
                points={`${nx},${ny - 3} ${nx + 2},${ny} ${nx},${ny + 3} ${nx - 2},${ny}`}
                fill="none"
                stroke="white"
                strokeWidth="0.4"
                opacity={0.5}
              />
            </g>
          );
        })}

        {/* Memory fragments */}
        {state.memoryFragments.filter(m => !m.collected).map((m, i) => (
          <circle key={`m${i}`} cx={toMapX(m.pos.x)} cy={toMapY(m.pos.y)} r={1.5}
            fill="hsl(270, 80%, 65%)" opacity={0.9}
          />
        ))}

        {/* Player */}
        <circle cx={px} cy={py} r={2.5}
          fill="hsl(120, 70%, 55%)" stroke="hsl(120, 90%, 70%)" strokeWidth="0.7"
        />
      </svg>
    </div>
  );
}
