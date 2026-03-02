import { GameState, InventorySlot, RARITY_COLORS } from '@/game/types';
import { useState } from 'react';

interface InventoryProps {
  state: GameState;
  onClose: () => void;
  onMoveToQuickslot: (invIdx: number, qsIdx: number) => void;
  onDrop: (invIdx: number) => void;
}

export default function Inventory({ state, onClose, onMoveToQuickslot, onDrop }: InventoryProps) {
  const [hoveredSlot, setHoveredSlot] = useState<{ slot: InventorySlot; x: number; y: number } | null>(null);
  const [selectedInv, setSelectedInv] = useState<number | null>(null);

  const { player } = state;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50" style={{ fontFamily: '"Press Start 2P", cursive' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/85" onClick={onClose} />

      <div className="relative bg-card pixel-border p-4 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs text-primary glow-cyan">INVENTORY</h2>
          <button onClick={onClose} className="text-[8px] text-muted-foreground hover:text-foreground">
            [ESC]
          </button>
        </div>

        {/* Inventory grid */}
        <div className="grid grid-cols-5 gap-1 mb-4">
          {player.inventory.map((slot, i) => (
            <div
              key={i}
              className={`relative w-12 h-12 flex items-center justify-center pixel-border cursor-pointer transition-all
                ${selectedInv === i ? 'border-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]' : 'hover:border-foreground/30'}
              `}
              style={{
                backgroundColor: slot ? `${RARITY_COLORS[slot.item.rarity]}11` : 'hsl(220, 45%, 8%)',
                borderColor: slot ? `${RARITY_COLORS[slot.item.rarity]}44` : undefined,
              }}
              onClick={() => setSelectedInv(selectedInv === i ? null : i)}
              onMouseEnter={(e) => slot && setHoveredSlot({ slot, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredSlot(null)}
            >
              {slot && (
                <>
                  <span className="text-base">{slot.item.icon}</span>
                  {slot.count > 1 && (
                    <span
                      className="absolute bottom-0.5 right-1 text-[7px]"
                      style={{ color: RARITY_COLORS[slot.item.rarity] }}
                    >
                      {slot.count}
                    </span>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Selected item actions */}
        {selectedInv !== null && player.inventory[selectedInv] && (
          <div className="mb-3 p-2 bg-secondary/30 pixel-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{player.inventory[selectedInv]!.item.icon}</span>
              <span
                className="text-[8px]"
                style={{ color: RARITY_COLORS[player.inventory[selectedInv]!.item.rarity] }}
              >
                {player.inventory[selectedInv]!.item.name}
              </span>
            </div>
            <p className="text-[7px] text-muted-foreground mb-2">
              {player.inventory[selectedInv]!.item.description}
            </p>
            <div className="flex gap-1 flex-wrap">
              {[0, 1, 2, 3, 4, 5].map(qi => (
                <button
                  key={qi}
                  className="text-[6px] px-1.5 py-1 bg-secondary pixel-border text-foreground/70 hover:text-primary hover:border-primary"
                  onClick={() => { onMoveToQuickslot(selectedInv, qi); setSelectedInv(null); }}
                >
                  →Q{qi + 1}
                </button>
              ))}
              <button
                className="text-[6px] px-1.5 py-1 bg-destructive/20 pixel-border text-destructive hover:text-destructive-foreground hover:bg-destructive"
                onClick={() => { onDrop(selectedInv); setSelectedInv(null); }}
              >
                DROP
              </button>
            </div>
          </div>
        )}

        {/* Quickslots */}
        <div>
          <span className="text-[7px] text-muted-foreground mb-1 block">QUICKSLOTS</span>
          <div className="flex gap-1">
            {player.quickslots.map((slot, i) => (
              <div
                key={i}
                className={`relative w-12 h-12 flex items-center justify-center pixel-border
                  ${i === player.activeQuickslot ? 'border-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]' : ''}
                `}
                style={{ backgroundColor: 'hsl(220, 45%, 10%)' }}
              >
                <span className="absolute top-0.5 left-1 text-[6px] text-muted-foreground">{i + 1}</span>
                {slot && (
                  <>
                    <span className="text-base">{slot.item.icon}</span>
                    {slot.count > 1 && (
                      <span className="absolute bottom-0.5 right-1 text-[7px]" style={{ color: RARITY_COLORS[slot.item.rarity] }}>
                        {slot.count}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredSlot && (
        <div
          className="fixed z-[60] p-2 bg-popover pixel-border max-w-[180px] pointer-events-none"
          style={{ left: hoveredSlot.x + 12, top: hoveredSlot.y - 10 }}
        >
          <div className="text-[8px] mb-0.5" style={{ color: RARITY_COLORS[hoveredSlot.slot.item.rarity] }}>
            {hoveredSlot.slot.item.name}
          </div>
          <div className="text-[6px] text-muted-foreground capitalize mb-0.5">
            {hoveredSlot.slot.item.rarity} {hoveredSlot.slot.item.category}
          </div>
          <div className="text-[7px] text-foreground/70">
            {hoveredSlot.slot.item.description}
          </div>
        </div>
      )}
    </div>
  );
}
