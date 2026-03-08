import {
  GameState, Player, Creature, Projectile, DroppedItem, AirBubble, Particle,
  Vec2, GameCallbacks, RARITY_COLORS, ItemDef, BossState, MemoryFragment, ZONE_NAMES,
  NPCState, DialogueNode, WaterCurrent,
} from './types';
import { ITEMS, CREATURE_TEMPLATES, BOSS_TEMPLATES, ZONE_CREATURES, NPC_DEFS } from './data';
import { RECIPES, canCraft } from './crafting';

// Upgraded resolution: 52px-based viewport
const GAME_W = 780;
const GAME_H = 440;
const GRAVITY = 30;
const SWIM_SPEED = 90;
const SWIM_ACCEL = 400;
const WATER_DRAG = 3;
const WORLD_W = 4000;
const WORLD_H = 1200;
const HARPOON_SPEED = 220;
const HARPOON_DAMAGE = 10;
const OXYGEN_DRAIN = 0.5;

// Zone boundaries (by Y position)
const ZONE_DEPTHS = [0, 240, 500, 780, 1000];

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: GameState;
  keys = new Set<string>();
  mouse: Vec2 = { x: 0, y: 0 };
  mouseDown = false;
  callbacks: GameCallbacks;
  animFrame = 0;
  lastTime = 0;
  running = false;
  // Screen effects
  screenShake: { intensity: number; duration: number; timer: number } = { intensity: 0, duration: 0, timer: 0 };
  damageFlash = 0;
  helmetCracks = 0;
  deathSequence = 0;
  deathActive = false;
  // Boss intro cinematic
  bossIntroTimer = 0;
  bossIntroActive = false;
  // Zone transition
  zoneTransitionTimer = 0;
  zoneTransitionName = '';
  zoneTransitionDepth = 0;
  prevZone = 0;
  // Water distortion
  distortionCanvas: HTMLCanvasElement | null = null;
  distortionCtx: CanvasRenderingContext2D | null = null;
  ripples: { x: number; y: number; radius: number; maxRadius: number; strength: number; time: number }[] = [];
  // Buff timers
  corruptedElixirTimer = 0;  // +50% damage for 8s
  inkSmokeTimer = 0;         // blind enemies for 5s

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.callbacks = callbacks;
    canvas.width = GAME_W;
    canvas.height = GAME_H;

    // Offscreen canvas for water distortion
    this.distortionCanvas = document.createElement('canvas');
    this.distortionCanvas.width = GAME_W;
    this.distortionCanvas.height = GAME_H;
    this.distortionCtx = this.distortionCanvas.getContext('2d')!;

    this.state = this.createInitialState();
    this.bindInput();
  }

  createInitialState(): GameState {
    const terrain = this.generateTerrain();
    const kelp = this.generateKelp(terrain);
    const rocks = this.generateRocks(terrain);
    const airBubbles = this.generateAirBubbles(terrain);
    const creatures = this.spawnCreatures(terrain);
    const waterCurrents = this.generateWaterCurrents(terrain);

    const player: Player = {
      pos: { x: 100, y: terrain[100] - 60 },
      vel: { x: 0, y: 0 },
      width: 16, height: 26,
      facing: 1, oxygen: 100, maxOxygen: 100,
      hp: 100, maxHp: 100,
      shootCooldown: 0, invincible: 0,
      inventory: Array(25).fill(null),
      quickslots: Array(6).fill(null),
      activeQuickslot: 0,
      animFrame: 0, animTimer: 0, swimBobble: 0,
    };
    player.quickslots[0] = { item: ITEMS.rusty_harpoon, count: 1 };
    player.inventory[0] = { item: ITEMS.oxygen_canister, count: 2 };

    const npcs = this.spawnNPCs(terrain);

    return {
      player, creatures, projectiles: [], droppedItems: [],
      airBubbles, particles: [], camera: { x: 0, y: 0 },
      worldWidth: WORLD_W, worldHeight: WORLD_H,
      terrain, kelp, rocks, time: 0, score: 0,
      gameOver: false, paused: false, showInventory: false,
      showSkillTree: false,
      depthZone: 0,
      boss: {
        active: false, phase: 1, creatureId: '',
        chargeTimer: 0, chargeDir: { x: 0, y: 0 }, isCharging: false,
        chargeCooldown: 3, comboCount: 0, comboCooldown: 2,
        phaseTransition: 0, roarTimer: 0, defeated: false,
      },
      memoryFragments: [],
      memoryCollected: null,
      npcs,
      activeDialogue: null,
      waterCurrents,
      skills: {
        levels: { diving: 0, combat: 0, stealth: 0, crafting: 0, resilience: 0 },
        skillPoints: 2,
        xp: 0,
        level: 1,
        statPoints: 3,
        stats: { vitality: 0, strength: 0, endurance: 0, lungCapacity: 0, precision: 0, agility: 0 },
        unlockedSkills: [],
      },
    };
  }

  generateTerrain(): number[] {
    const t: number[] = [];
    for (let x = 0; x < WORLD_W; x++) {
      const base = WORLD_H - 120;
      const hill = Math.sin(x * 0.005) * 60 + Math.sin(x * 0.018) * 35 + Math.sin(x * 0.04) * 15;
      const cave = Math.sin(x * 0.012) > 0.7 ? Math.sin(x * 0.012) * 40 : 0;
      // Add some plateaus
      const plateau = Math.sin(x * 0.003) > 0.85 ? -30 : 0;
      t[x] = Math.floor(base + hill - cave + plateau);
    }
    return t;
  }

  generateKelp(terrain: number[]) {
    const kelps: GameState['kelp'] = [];
    for (let x = 50; x < WORLD_W - 50; x += 12 + Math.floor(Math.random() * 25)) {
      if (Math.random() < 0.65) {
        kelps.push({ x, height: 40 + Math.random() * 90, phase: Math.random() * Math.PI * 2 });
      }
    }
    return kelps;
  }

  generateRocks(terrain: number[]) {
    const rocks: GameState['rocks'] = [];
    for (let x = 30; x < WORLD_W - 30; x += 15 + Math.floor(Math.random() * 40)) {
      if (Math.random() < 0.45) {
        rocks.push({ x, y: terrain[x], size: 5 + Math.random() * 14 });
      }
    }
    return rocks;
  }

  generateWaterCurrents(terrain: number[]): WaterCurrent[] {
    const currents: WaterCurrent[] = [];
    const zoneW = WORLD_W / 5;

    // Zone 0 (The Shallows) — several currents with varied directions
    const zone0Currents = [
      // Rightward current near start — helps player move toward middle
      { x: 150, yOff: -120, dx: 1, dy: 0.1, len: 200, w: 60, str: 80 },
      // Upward current near coral ridge area
      { x: 350, yOff: -180, dx: 0.3, dy: -0.95, len: 120, w: 50, str: 70 },
      // Strong rightward current mid-zone — the main "ride" current
      { x: 450, yOff: -100, dx: 1, dy: -0.2, len: 250, w: 70, str: 120 },
      // Downward current near Rotjaw's area — danger zone pull
      { x: 680, yOff: -150, dx: 0.5, dy: 0.85, len: 100, w: 45, str: 60 },
    ];

    for (const c of zone0Currents) {
      const tx = terrain[Math.floor(Math.min(c.x, terrain.length - 1))];
      const mag = Math.sqrt(c.dx * c.dx + c.dy * c.dy);
      currents.push({
        pos: { x: c.x, y: tx + c.yOff },
        dir: { x: c.dx / mag, y: c.dy / mag },
        length: c.len,
        width: c.w,
        strength: c.str,
        zone: 0,
      });
    }

    return currents;
  }

  generateAirBubbles(terrain: number[]): AirBubble[] {
    const bubbles: AirBubble[] = [];
    for (let x = 80; x < WORLD_W - 80; x += 120 + Math.floor(Math.random() * 200)) {
      const ty = terrain[Math.min(x, terrain.length - 1)];
      bubbles.push({
        pos: { x, y: ty - 40 - Math.random() * 80 },
        size: 8, active: true, respawnTimer: 0,
      });
    }
    return bubbles;
  }

  spawnCreatures(terrain: number[]): Creature[] {
    const creatures: Creature[] = [];
    let id = 0;

    // Zone-based creature spawning
    for (let zone = 0; zone <= 4; zone++) {
      const zoneKeys = ZONE_CREATURES[zone] || [];
      if (zoneKeys.length === 0) continue;

      const zoneMinX = zone * (WORLD_W / 5);
      const zoneMaxX = (zone + 1) * (WORLD_W / 5);
      const count = zone <= 2 ? 10 : 6;

      for (let i = 0; i < count; i++) {
        const key = zoneKeys[Math.floor(Math.random() * zoneKeys.length)];
        const tmpl = CREATURE_TEMPLATES[key as keyof typeof CREATURE_TEMPLATES];
        if (!tmpl) continue;

        const x = zoneMinX + 50 + Math.random() * (zoneMaxX - zoneMinX - 100);
        const tx = terrain[Math.floor(Math.min(x, terrain.length - 1))];
        const y = tx - 40 - Math.random() * 200;

        creatures.push({
          id: `c_${id++}`,
          name: tmpl.name,
          hp: tmpl.hp, maxHp: tmpl.hp,
          damage: tmpl.damage, speed: tmpl.speed,
          behavior: tmpl.behavior,
          attackRange: tmpl.attackRange,
          patrolRange: tmpl.patrolRange,
          width: tmpl.width, height: tmpl.height,
          spriteType: tmpl.spriteType,
          xpValue: tmpl.xpValue,
          lootTable: tmpl.lootTable,
          rangedAttack: (tmpl as any).rangedAttack,
          pos: { x, y },
          vel: { x: 0, y: 0 },
          facing: Math.random() > 0.5 ? 1 : -1,
          state: 'patrol',
          attackCooldown: 0,
          patrolOrigin: { x, y },
          deathTimer: 0,
          rangedCooldown: 0,
          animFrame: 0, animTimer: 0,
          corruptionPulse: Math.random() * Math.PI * 2,
          poisonTimer: 0, poisonDamage: 0,
        });
      }
    }

    // Spawn bosses at zone boundaries (end of each zone's X range)
    const bossX = WORLD_W / 5 * 1 - 30; // near end of zone 0 (~770px)
    const bossTx = terrain[Math.floor(Math.min(bossX, terrain.length - 1))];
    creatures.push(this.createBossCreature('boss_rotjaw', BOSS_TEMPLATES.rotjaw, bossX, bossTx - 80));

    const tangleX = WORLD_W / 5 * 2 - 100; // end of zone 1
    const tangleTx = terrain[Math.floor(Math.min(tangleX, terrain.length - 1))];
    creatures.push(this.createBossCreature('boss_tangle', BOSS_TEMPLATES.the_tangle, tangleX, tangleTx - 100));

    const zeroX = WORLD_W / 5 * 3 - 100; // end of zone 2
    const zeroTx = terrain[Math.floor(Math.min(zeroX, terrain.length - 1))];
    creatures.push(this.createBossCreature('boss_subject_zero', BOSS_TEMPLATES.subject_zero, zeroX, zeroTx - 80));

    return creatures;
  }

  createBossCreature(bossId: string, tmpl: any, x: number, y: number): Creature {
    return {
      id: bossId,
      name: tmpl.name,
      hp: tmpl.hp, maxHp: tmpl.hp,
      damage: tmpl.damage, speed: tmpl.speed,
      behavior: tmpl.behavior,
      attackRange: tmpl.attackRange,
      patrolRange: tmpl.patrolRange,
      width: tmpl.width, height: tmpl.height,
      spriteType: tmpl.spriteType,
      xpValue: tmpl.xpValue,
      lootTable: tmpl.lootTable,
      pos: { x, y },
      vel: { x: 0, y: 0 },
      facing: -1, state: 'patrol',
      attackCooldown: 0,
      patrolOrigin: { x, y },
      deathTimer: 0, rangedCooldown: 0,
      animFrame: 0, animTimer: 0,
      corruptionPulse: 0,
      poisonTimer: 0, poisonDamage: 0,
    };
  }

  bindInput() {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (down) this.keys.add(e.key.toLowerCase());
      else this.keys.delete(e.key.toLowerCase());

      if (down && e.key.toLowerCase() === 'i') {
        this.state.showInventory = !this.state.showInventory;
        this.state.showSkillTree = false;
        this.state.paused = this.state.showInventory;
        this.callbacks.onStateUpdate({ ...this.state });
      }
      if (down && e.key.toLowerCase() === 'k') {
        this.state.showSkillTree = !this.state.showSkillTree;
        this.state.showInventory = false;
        this.state.paused = this.state.showSkillTree;
        this.callbacks.onStateUpdate({ ...this.state });
      }
      if (down && e.key >= '1' && e.key <= '6') {
        this.state.player.activeQuickslot = parseInt(e.key) - 1;
        this.callbacks.onStateUpdate({ ...this.state });
      }
      if (down && e.key.toLowerCase() === 'e') {
        // Check for NPC interaction first
        if (this.tryInteractNPC()) {
          // NPC interaction handled
        } else {
          this.useActiveQuickslot();
        }
      }
      // Advance dialogue with F or Space
      if (down && (e.key.toLowerCase() === 'f' || e.key === ' ') && this.state.activeDialogue) {
        this.advanceDialogue();
      }
    };
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = GAME_W / rect.width;
      const scaleY = GAME_H / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    });
    this.canvas.addEventListener('mousedown', () => { this.mouseDown = true; });
    this.canvas.addEventListener('mouseup', () => { this.mouseDown = false; });
  }

  useActiveQuickslot() {
    const slot = this.state.player.quickslots[this.state.player.activeQuickslot];
    if (!slot) return;
    if (slot.item.category === 'consumable') {
      if (slot.item.id === 'oxygen_canister') {
        this.state.player.oxygen = Math.min(this.state.player.maxOxygen, this.state.player.oxygen + 30);
      } else if (slot.item.id === 'antitoxin') {
        this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 20);
      }
      slot.count--;
      if (slot.count <= 0) this.state.player.quickslots[this.state.player.activeQuickslot] = null;
      this.callbacks.onStateUpdate({ ...this.state });
    }
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }

  loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (!this.state.paused && !this.state.gameOver) {
      this.update(dt);
    } else if (this.deathActive) {
      this.updateDeathSequence(dt);
    }
    this.updateScreenShake(dt);
    this.render();
    this.state.time += dt;
    this.animFrame = requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    const oldZone = this.state.depthZone;

    // During boss intro, only update camera and particles
    if (this.bossIntroActive) {
      this.bossIntroTimer -= dt;
      this.updateCamera();
    this.updateNPCs(dt);
    this.updateParticles(dt);
      if (this.bossIntroTimer <= 0) {
        this.bossIntroActive = false;
      }
      this.callbacks.onStateUpdate({ ...this.state });
      return;
    }

    this.updatePlayer(dt);
    this.updateProjectiles(dt);
    this.updateCreatures(dt);
    this.updateBoss(dt);
    this.updateDroppedItems(dt);
    this.updateMemoryFragments(dt);
    this.updateAirBubbles(dt);
    this.updateParticles(dt);
    this.updateCamera();
    this.spawnAmbientParticles(dt);
    this.state.depthZone = Math.min(4, Math.floor(this.state.player.pos.x / (WORLD_W / 5)));

    // Zone transition detection
    if (this.state.depthZone !== oldZone) {
      this.zoneTransitionTimer = 3.5;
      this.zoneTransitionName = ZONE_NAMES[this.state.depthZone] || 'Unknown';
      // Depth based on zone index (each zone ~200m apart)
      const zoneDepths = [100, 300, 700, 1000, 1400];
      this.zoneTransitionDepth = zoneDepths[this.state.depthZone] || 0;
      this.prevZone = oldZone;
    }

    if (this.zoneTransitionTimer > 0) this.zoneTransitionTimer -= dt;
    this.updateRipples(dt);

    // Player wake ripples when moving
    const p = this.state.player;
    const speed = Math.sqrt(p.vel.x ** 2 + p.vel.y ** 2);
    if (speed > 30 && Math.random() < speed * 0.003) {
      this.spawnRipple(
        p.pos.x + p.width / 2 - p.facing * 8,
        p.pos.y + p.height / 2,
        12 + speed * 0.15,
        0.5
      );
      // Wake trail particles
      this.state.particles.push({
        pos: { x: p.pos.x + p.width / 2 - p.facing * 6, y: p.pos.y + p.height / 2 },
        vel: { x: -p.vel.x * 0.15, y: -p.vel.y * 0.1 },
        lifetime: 0.6, maxLifetime: 0.6, size: 1.5,
        color: 'rgba(150, 220, 255, 0.2)', type: 'wake',
      });
    }

    this.callbacks.onStateUpdate({ ...this.state });
  }

  getStatBonus(stat: string): number {
    const s = this.state.skills.stats;
    switch (stat) {
      case 'maxHp': return (s.vitality || 0) * 8;
      case 'damage': return (s.strength || 0) * 5;
      case 'defense': return (s.endurance || 0) * 4;
      case 'maxOxygen': return (s.lungCapacity || 0) * 6;
      case 'critChance': return (s.precision || 0) * 0.03;
      case 'speedMult': return 1 + (s.agility || 0) * 0.04;
      default: return 0;
    }
  }

  getEquippedWeaponDamage(): number {
    const slot = this.state.player.quickslots[this.state.player.activeQuickslot];
    if (!slot || slot.item.category !== 'weapon') return 0;
    switch (slot.item.id) {
      case 'reinforced_harpoon': return 8;
      case 'venomous_harpoon': return 12;
      case 'abyssal_lance': return 20;
      case 'tentacle_whip': return 14;       // strong + extended range
      default: return 0;
    }
  }

  hasEquippedGear(itemId: string): boolean {
    return this.state.player.quickslots.some(s => s && s.item.id === itemId);
  }

  getGearDamageReduction(): number {
    let reduction = 0;
    if (this.hasEquippedGear('bone_armor')) reduction += 0.15;
    if (this.hasEquippedGear('tangle_shield')) reduction += 0.25;
    return Math.min(reduction, 0.6); // cap at 60%
  }

  getGearOxygenReduction(): number {
    let reduction = 0;
    if (this.hasEquippedGear('pressure_suit')) reduction += 0.20;
    return reduction;
  }

  getDetectionMultiplier(): number {
    let mult = 1;
    if (this.hasEquippedGear('ink_cloak')) mult *= 0.7; // -30% detection
    if (this.inkSmokeTimer > 0) mult *= 0.15;           // near-invisible during smoke
    return mult;
  }

  getDamageBonusMultiplier(): number {
    let mult = 1;
    if (this.corruptedElixirTimer > 0) mult *= 1.5;
    return mult;
  }

  getHarpoonLifetimeBonus(): number {
    if (this.hasEquippedGear('tentacle_whip')) return 0.6; // +40% effective range via lifetime
    return 0;
  }

  retaliateOnHit(attackerPos: Vec2) {
    if (!this.hasEquippedGear('tangle_shield')) return;
    // Spawn retaliation damage to nearby creatures
    for (const c of this.state.creatures) {
      if (c.state === 'dead') continue;
      const dx = c.pos.x - attackerPos.x;
      const dy = c.pos.y - attackerPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 60) {
        const retDmg = 8;
        c.hp -= retDmg;
        this.spawnDamageNumber(c.pos.x + c.width / 2, c.pos.y, retDmg, '#aa66ff');
        this.spawnDamageParticles(c.pos.x + c.width / 2, c.pos.y + c.height / 2, false);
        // Purple retaliation particles
        for (let i = 0; i < 3; i++) {
          this.state.particles.push({
            pos: { x: c.pos.x + c.width / 2, y: c.pos.y + c.height / 2 },
            vel: { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 60 },
            lifetime: 0.4, maxLifetime: 0.4, size: 3, color: '#aa44ff', type: 'corruption',
          });
        }
        if (c.hp <= 0) this.killCreature(c);
      }
    }
  }

  updatePlayer(dt: number) {
    const p = this.state.player;
    let ax = 0, ay = 0;

    const speedMult = this.getStatBonus('speedMult') as number;

    if (this.keys.has('a') || this.keys.has('arrowleft')) { ax -= SWIM_ACCEL; p.facing = -1; }
    if (this.keys.has('d') || this.keys.has('arrowright')) { ax += SWIM_ACCEL; p.facing = 1; }
    if (this.keys.has('w') || this.keys.has('arrowup')) ay -= SWIM_ACCEL;
    if (this.keys.has('s') || this.keys.has('arrowdown')) ay += SWIM_ACCEL;

    p.vel.x += ax * dt;
    p.vel.y += (ay + GRAVITY) * dt;

    // Apply water current forces
    for (const current of this.state.waterCurrents) {
      const cx = p.pos.x + p.width / 2 - current.pos.x;
      const cy = p.pos.y + p.height / 2 - current.pos.y;
      // Project player position onto current direction
      const along = cx * current.dir.x + cy * current.dir.y;
      const perpX = cx - along * current.dir.x;
      const perpY = cy - along * current.dir.y;
      const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
      // Check if player is within current bounds
      if (along >= 0 && along <= current.length && perpDist < current.width / 2) {
        const falloff = 1 - (perpDist / (current.width / 2));
        const force = current.strength * falloff;
        p.vel.x += current.dir.x * force * dt;
        p.vel.y += current.dir.y * force * dt;
      }
    }

    p.vel.x *= 1 - WATER_DRAG * dt;
    p.vel.y *= 1 - WATER_DRAG * dt;

    const maxSpeed = SWIM_SPEED * speedMult * 1.8; // Allow higher speed when riding currents
    const speed = Math.sqrt(p.vel.x ** 2 + p.vel.y ** 2);
    if (speed > maxSpeed) {
      p.vel.x = (p.vel.x / speed) * maxSpeed;
      p.vel.y = (p.vel.y / speed) * maxSpeed;
    }

    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.pos.x = Math.max(8, Math.min(WORLD_W - 8, p.pos.x));
    p.pos.y = Math.max(15, Math.min(WORLD_H - 30, p.pos.y));

    // Terrain collision
    const tx = Math.floor(Math.max(0, Math.min(p.pos.x, this.state.terrain.length - 1)));
    const terrainY = this.state.terrain[tx];
    if (p.pos.y + p.height > terrainY) {
      p.pos.y = terrainY - p.height;
      p.vel.y = Math.min(0, p.vel.y);
    }

    // Animation
    p.animTimer += dt;
    if (Math.abs(p.vel.x) > 8 || Math.abs(p.vel.y) > 8) {
      if (p.animTimer > 0.1) { p.animFrame = (p.animFrame + 1) % 6; p.animTimer = 0; }
    } else {
      if (p.animTimer > 0.4) { p.animFrame = (p.animFrame + 1) % 3; p.animTimer = 0; }
    }
    p.swimBobble = Math.sin(this.state.time * 2) * 1.5;

    // Max HP/O2 from stats
    p.maxHp = 100 + this.getStatBonus('maxHp');
    p.maxOxygen = 100 + this.getStatBonus('maxOxygen');

    // Oxygen drain - deeper = faster
    const depthFactor = 1 + (p.pos.y / WORLD_H) * 3;
    const divingReduction = 1 - this.state.skills.levels.diving * 0.1;
    const gearO2Reduction = 1 - this.getGearOxygenReduction();
    p.oxygen -= OXYGEN_DRAIN * depthFactor * divingReduction * gearO2Reduction * dt;
    if (p.oxygen <= 0) {
      p.oxygen = 0;
      p.hp -= 10 * dt;
    }
    if (p.hp <= 0) {
      this.state.gameOver = true;
      this.deathActive = true;
      this.deathSequence = 0;
      this.callbacks.onPlayerDeath();
    }

    // Shooting
    const combatSpeed = 1 + this.state.skills.levels.combat * 0.08;
    p.shootCooldown -= dt;
    if ((this.mouseDown || this.keys.has(' ')) && p.shootCooldown <= 0) {
      this.shootHarpoon();
      p.shootCooldown = 0.4 / combatSpeed;
    }

    if (p.invincible > 0) p.invincible -= dt;
  }

  shootHarpoon() {
    const p = this.state.player;
    const worldMouseX = this.mouse.x + this.state.camera.x;
    const worldMouseY = this.mouse.y + this.state.camera.y;
    const dx = worldMouseX - (p.pos.x + p.width / 2);
    const dy = worldMouseY - (p.pos.y + p.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const dmgBonus = this.getStatBonus('damage');
    const weaponBonus = this.getEquippedWeaponDamage();
    const baseDmg = HARPOON_DAMAGE + dmgBonus + weaponBonus + this.state.skills.levels.combat * 3;

    // Critical hit
    const critChance = this.getStatBonus('critChance');
    const isCrit = Math.random() < critChance;
    const finalDmg = isCrit ? baseDmg * 2 : baseDmg;

    this.state.projectiles.push({
      pos: { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 },
      vel: { x: (dx / dist) * HARPOON_SPEED, y: (dy / dist) * HARPOON_SPEED },
      width: 5, height: 3, damage: finalDmg,
      lifetime: 1.5, fromPlayer: true, type: isCrit ? 'harpoon_crit' : 'harpoon',
    });

    for (let i = 0; i < 4; i++) {
      this.state.particles.push({
        pos: { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 },
        vel: { x: (dx / dist) * 60 + (Math.random() - 0.5) * 30, y: (dy / dist) * 60 + (Math.random() - 0.5) * 30 },
        lifetime: 0.3, maxLifetime: 0.3, size: 2 + Math.random(), color: isCrit ? '#ffdd44' : '#66eeff', type: 'bubble',
      });
    }
  }

  updateProjectiles(dt: number) {
    this.state.projectiles = this.state.projectiles.filter(proj => {
      proj.pos.x += proj.vel.x * dt;
      proj.pos.y += proj.vel.y * dt;
      proj.lifetime -= dt;
      if (proj.lifetime <= 0) return false;

      const tx = Math.floor(Math.max(0, Math.min(proj.pos.x, this.state.terrain.length - 1)));
      if (proj.pos.y > this.state.terrain[tx]) {
        // Impact ripple on terrain hit
        if (proj.fromPlayer) {
          this.spawnRipple(proj.pos.x, proj.pos.y, 25);
        }
        return false;
      }

      if (proj.fromPlayer) {
        for (const c of this.state.creatures) {
          if (c.state === 'dead') continue;
          if (this.aabb(proj, c)) {
            c.hp -= proj.damage;
            c.state = 'chase';
            this.spawnDamageParticles(c.pos.x + c.width / 2, c.pos.y + c.height / 2, proj.type === 'harpoon_crit');
            this.spawnDamageNumber(c.pos.x + c.width / 2, c.pos.y, proj.damage, proj.type === 'harpoon_crit' ? '#ffdd44' : '#ffffff');
            // Harpoon impact ripple
            this.spawnRipple(c.pos.x + c.width / 2, c.pos.y + c.height / 2, proj.type === 'harpoon_crit' ? 45 : 30);
            // Venomous Harpoon poison
            if (this.hasEquippedGear('venomous_harpoon')) {
              c.poisonTimer = 4;
              c.poisonDamage = 3;
            }
            if (c.hp <= 0) this.killCreature(c);
            return false;
          }
        }
      } else {
        const p = this.state.player;
        if (p.invincible <= 0 && this.aabb(proj, p)) {
          const defense = this.getStatBonus('defense');
          const dmg = Math.max(1, Math.floor((proj.damage - defense) * (1 - this.getGearDamageReduction())));
          p.hp -= dmg;
          p.invincible = 0.5;
          this.spawnDamageParticles(p.pos.x + p.width / 2, p.pos.y + p.height / 2, false);
          this.spawnDamageNumber(p.pos.x + p.width / 2, p.pos.y, dmg, '#ff4444');
          this.triggerScreenShake(3, 0.2);
          this.damageFlash = 0.15;
          this.helmetCracks = Math.min(5, Math.floor((1 - p.hp / p.maxHp) * 5));
          if (p.hp <= 0) {
            this.state.gameOver = true;
            this.deathActive = true;
            this.deathSequence = 0;
            this.callbacks.onPlayerDeath();
          }
          return false;
        }
      }
      return true;
    });
  }

  killCreature(c: Creature) {
    c.state = 'dead';
    this.callbacks.onCreatureKill(c.name);
    this.state.score += 10;

    // Grant XP
    const xpGain = c.xpValue || (15 + Math.floor(Math.random() * 10));
    this.state.skills.xp += xpGain;
    if (this.state.skills.xp >= 100) {
      this.state.skills.xp -= 100;
      this.state.skills.level++;
      this.state.skills.skillPoints += 2;
      this.state.skills.statPoints += 3;
    }

    // ===== CREATURE-SPECIFIC DEATH ANIMATIONS =====
    const cx = c.pos.x + c.width / 2;
    const cy = c.pos.y + c.height / 2;

    switch (c.spriteType) {
      case 'shark':
      case 'rotjaw': {
        // Sharks: barrel roll descent with pixel chunks
        c.deathTimer = c.spriteType === 'rotjaw' ? 5 : 3;
        c.vel.y = 15; // sink
        c.vel.x = c.facing * 10;
        // Large pixel chunk explosion
        for (let i = 0; i < 18; i++) {
          const angle = (i / 18) * Math.PI * 2;
          const speed = 30 + Math.random() * 50;
          this.state.particles.push({
            pos: { x: cx, y: cy },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifetime: 2, maxLifetime: 2, size: 3 + Math.random() * 4,
            color: i % 3 === 0 ? '#556070' : i % 3 === 1 ? '#ff4444' : '#443038',
            type: 'death_chunk', rotation: Math.random() * Math.PI * 2, rotationSpeed: (Math.random() - 0.5) * 8,
          });
        }
        // Blood-corruption trail
        for (let i = 0; i < 10; i++) {
          this.state.particles.push({
            pos: { x: cx + (Math.random() - 0.5) * c.width, y: cy + (Math.random() - 0.5) * c.height },
            vel: { x: (Math.random() - 0.5) * 20, y: 5 + Math.random() * 15 },
            lifetime: 3, maxLifetime: 3, size: 2 + Math.random() * 2,
            color: '#aa2233', type: 'corruption',
          });
        }
        this.triggerScreenShake(4, 0.4);
        break;
      }
      case 'tangle': {
        // Tangle: tentacles fly apart, ink explosion
        c.deathTimer = 5;
        // Tentacle fragments flying in all directions
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2;
          const speed = 20 + Math.random() * 60;
          this.state.particles.push({
            pos: { x: cx, y: cy },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifetime: 3, maxLifetime: 3, size: 4 + Math.random() * 5,
            color: i % 3 === 0 ? '#443350' : i % 3 === 1 ? '#66ff88' : '#221133',
            type: 'death_chunk', rotation: Math.random() * Math.PI * 2, rotationSpeed: (Math.random() - 0.5) * 6,
          });
        }
        // Massive ink cloud
        for (let i = 0; i < 20; i++) {
          this.state.particles.push({
            pos: { x: cx + (Math.random() - 0.5) * c.width, y: cy + (Math.random() - 0.5) * c.height },
            vel: { x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 30 },
            lifetime: 4, maxLifetime: 4, size: 6 + Math.random() * 4,
            color: '#110822', type: 'corruption',
          });
        }
        // Green bio-luminescent sparks from severed tentacles
        for (let i = 0; i < 15; i++) {
          this.state.particles.push({
            pos: { x: cx, y: cy },
            vel: { x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80 },
            lifetime: 1.5, maxLifetime: 1.5, size: 2 + Math.random(),
            color: '#88ff66', type: 'spark',
          });
        }
        this.triggerScreenShake(6, 0.5);
        break;
      }
      case 'subject_zero': {
        // Subject Zero: glitch death — rapid flashing, erratic particles
        c.deathTimer = 5;
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 40 + Math.random() * 60;
          this.state.particles.push({
            pos: { x: cx, y: cy },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifetime: 2 + Math.random(), maxLifetime: 3, size: 3 + Math.random() * 3,
            color: Math.random() > 0.5 ? '#ff6644' : '#443344',
            type: 'death_chunk', rotation: Math.random() * 6, rotationSpeed: (Math.random() - 0.5) * 10,
          });
        }
        // Core explosion sparks
        for (let i = 0; i < 12; i++) {
          this.state.particles.push({
            pos: { x: cx, y: cy },
            vel: { x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 100 },
            lifetime: 1, maxLifetime: 1, size: 2,
            color: '#ff8844', type: 'spark',
          });
        }
        this.triggerScreenShake(8, 0.5);
        this.damageFlash = 0.15;
        break;
      }
      case 'jelly': {
        // Jellyfish: burst into electric sparks
        c.deathTimer = 1.5;
        for (let i = 0; i < 25; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 40 + Math.random() * 80;
          this.state.particles.push({
            pos: { x: cx, y: cy },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifetime: 0.8 + Math.random() * 0.6, maxLifetime: 1.4,
            size: 1 + Math.random() * 2,
            color: Math.random() > 0.3 ? '#aabbff' : '#ffffff',
            type: 'spark',
          });
        }
        // Electric arc particles
        for (let i = 0; i < 8; i++) {
          this.state.particles.push({
            pos: { x: cx + (Math.random() - 0.5) * 20, y: cy + (Math.random() - 0.5) * 20 },
            vel: { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 60 },
            lifetime: 0.3 + Math.random() * 0.3, maxLifetime: 0.6,
            size: 1, color: '#8866ff', type: 'spark',
          });
        }
        // Brief flash
        this.damageFlash = 0.05;
        break;
      }
      case 'eel': {
        // Eel: segmented dissolve — segments fly apart
        c.deathTimer = 2;
        for (let seg = 0; seg < 6; seg++) {
          const segX = c.pos.x + seg * (c.width / 6);
          const delay = seg * 0.1;
          this.state.particles.push({
            pos: { x: segX, y: cy },
            vel: { x: (Math.random() - 0.5) * 40, y: -10 - Math.random() * 20 },
            lifetime: 1.5 + delay, maxLifetime: 1.5 + delay, size: 4 + Math.random() * 2,
            color: `rgb(${50 + seg * 10}, ${90 + seg * 15}, ${50 + seg * 10})`,
            type: 'death_chunk', rotation: Math.random() * 6, rotationSpeed: (Math.random() - 0.5) * 5,
          });
        }
        // Acid splash on death
        for (let i = 0; i < 8; i++) {
          this.state.particles.push({
            pos: { x: cx, y: cy },
            vel: { x: (Math.random() - 0.5) * 50, y: 10 + Math.random() * 20 },
            lifetime: 1.5, maxLifetime: 1.5, size: 2 + Math.random(),
            color: '#66ff44', type: 'poison',
          });
        }
        break;
      }
      case 'crab': {
        // Crab: shell crack + collapse
        c.deathTimer = 2.5;
        // Shell fragments
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          this.state.particles.push({
            pos: { x: cx, y: cy },
            vel: { x: Math.cos(angle) * (20 + Math.random() * 30), y: Math.sin(angle) * (20 + Math.random() * 30) },
            lifetime: 2, maxLifetime: 2, size: 2 + Math.random() * 3,
            color: i % 2 === 0 ? '#885533' : '#aa7755',
            type: 'death_chunk', rotation: Math.random() * 6, rotationSpeed: (Math.random() - 0.5) * 4,
          });
        }
        // Orange glow burst from inside
        for (let i = 0; i < 6; i++) {
          this.state.particles.push({
            pos: { x: cx, y: cy },
            vel: { x: (Math.random() - 0.5) * 30, y: -15 - Math.random() * 15 },
            lifetime: 1, maxLifetime: 1, size: 2,
            color: '#ffaa44', type: 'glow',
          });
        }
        break;
      }
      default: {
        // Fish: pixel chunk explosion — classic burst
        c.deathTimer = 1.5;
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 30 + Math.random() * 50;
          this.state.particles.push({
            pos: { x: cx, y: cy },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifetime: 1 + Math.random(), maxLifetime: 2, size: 2 + Math.random() * 2,
            color: Math.random() > 0.5 ? '#884466' : '#ff4466',
            type: 'death_chunk', rotation: Math.random() * 6, rotationSpeed: (Math.random() - 0.5) * 6,
          });
        }
        break;
      }
    }

    // Boss-specific death — handles all bosses
    const bossTemplateMap: Record<string, any> = {
      boss_rotjaw: BOSS_TEMPLATES.rotjaw,
      boss_tangle: BOSS_TEMPLATES.the_tangle,
      boss_subject_zero: BOSS_TEMPLATES.subject_zero,
    };
    const bossTmpl = bossTemplateMap[c.id];
    if (bossTmpl) {
      this.state.boss.defeated = true;
      this.state.boss.active = false;
      this.state.memoryFragments.push({
        pos: { x: cx, y: c.pos.y },
        vel: { x: 0, y: -15 },
        lifetime: 60, bobOffset: 0, collected: false, collectTimer: 0,
        title: bossTmpl.memoryFragment.title, text: bossTmpl.memoryFragment.text,
      });
      // Massive multi-ring shockwave
      for (let ring = 0; ring < 3; ring++) {
        this.state.particles.push({
          pos: { x: cx, y: cy },
          vel: { x: 0, y: 0 },
          lifetime: 1.5 + ring * 0.3, maxLifetime: 1.5 + ring * 0.3,
          size: 5 + ring * 20,
          color: ring === 0 ? '#ffffff' : ring === 1 ? '#ff4422' : '#aa22ff',
          type: 'shockwave',
        });
      }
      for (let i = 0; i < 25; i++) {
        this.state.particles.push({
          pos: { x: cx, y: cy },
          vel: { x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80 },
          lifetime: 3, maxLifetime: 3, size: 2 + Math.random() * 3,
          color: '#cc88ff', type: 'memory',
        });
      }
      this.triggerScreenShake(8, 0.6);
    }

    // Drop loot
    for (const loot of c.lootTable) {
      if (Math.random() < loot.chance) {
        const item = ITEMS[loot.itemId];
        if (item) {
          const count = loot.minCount + Math.floor(Math.random() * (loot.maxCount - loot.minCount + 1));
          this.state.droppedItems.push({
            pos: { x: c.pos.x + Math.random() * 10, y: c.pos.y },
            vel: { x: (Math.random() - 0.5) * 40, y: -25 - Math.random() * 25 },
            item, count, lifetime: 30,
            bobOffset: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    // Corruption stain particles left behind
    for (let i = 0; i < 4; i++) {
      this.state.particles.push({
        pos: { x: cx + (Math.random() - 0.5) * c.width, y: cy + c.height / 2 },
        vel: { x: (Math.random() - 0.5) * 5, y: 0 },
        lifetime: 8, maxLifetime: 8, size: 3 + Math.random() * 2,
        color: '#44112244', type: 'corruption',
      });
    }
  }

  updateBoss(dt: number) {
    const boss = this.state.boss;
    if (boss.defeated) return;

    // Find any active boss nearby
    const bossIds = ['boss_rotjaw', 'boss_tangle', 'boss_subject_zero'];
    let bossCreature: Creature | undefined;
    for (const bid of bossIds) {
      const bc = this.state.creatures.find(c => c.id === bid && c.state !== 'dead');
      if (!bc) continue;
      const p = this.state.player;
      const d = Math.sqrt((p.pos.x - bc.pos.x) ** 2 + (p.pos.y - bc.pos.y) ** 2);
      if (d < 300 || (boss.active && boss.creatureId === bid)) {
        bossCreature = bc;
        break;
      }
    }
    if (!bossCreature) return;

    const p = this.state.player;
    const dx = p.pos.x - bossCreature.pos.x;
    const dy = p.pos.y - bossCreature.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Activate boss when player is near — CINEMATIC INTRO
    if (!boss.active && dist < 250) {
      boss.active = true;
      boss.creatureId = bossCreature.id;
      bossCreature.state = 'chase';

      // Trigger boss intro cinematic
      this.bossIntroActive = true;
      this.bossIntroTimer = 3.0;

      // Gate slam particles
      const bx = bossCreature.pos.x + bossCreature.width / 2;
      const by = bossCreature.pos.y + bossCreature.height / 2;
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 10; i++) {
          this.state.particles.push({
            pos: { x: bx + side * 200, y: by - 50 + i * 12 },
            vel: { x: 0, y: 0 },
            lifetime: 2.5, maxLifetime: 2.5, size: 6,
            color: '#334455', type: 'death_chunk',
          });
        }
      }
      this.triggerScreenShake(6, 0.5);

      // Spotlight particles converging on boss
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const r = 100 + Math.random() * 50;
        this.state.particles.push({
          pos: { x: bx + Math.cos(angle) * r, y: by + Math.sin(angle) * r },
          vel: { x: -Math.cos(angle) * 40, y: -Math.sin(angle) * 40 },
          lifetime: 2, maxLifetime: 2, size: 2,
          color: bossCreature.spriteType === 'tangle' ? '#44ff88' : bossCreature.spriteType === 'subject_zero' ? '#ff8844' : '#ffaa44',
          type: 'glow',
        });
      }
    }

    if (!boss.active) return;

    // Determine phase based on HP
    const hpPct = bossCreature.hp / bossCreature.maxHp;
    const newPhase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
    if (newPhase !== boss.phase) {
      boss.phase = newPhase as 1 | 2 | 3;
      boss.phaseTransition = 2.0;

      const bx = bossCreature.pos.x + bossCreature.width / 2;
      const by = bossCreature.pos.y + bossCreature.height / 2;

      for (let ring = 0; ring < 2; ring++) {
        this.state.particles.push({
          pos: { x: bx, y: by },
          vel: { x: 0, y: 0 },
          lifetime: 1.2 + ring * 0.3, maxLifetime: 1.2 + ring * 0.3,
          size: 10 + ring * 30,
          color: newPhase === 3 ? '#ff2222' : '#ff6644',
          type: 'shockwave',
        });
      }

      for (let i = 0; i < 25; i++) {
        const angle = (i / 25) * Math.PI * 2;
        const speed = 60 + Math.random() * 60;
        this.state.particles.push({
          pos: { x: bx, y: by },
          vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          lifetime: 1.5, maxLifetime: 1.5, size: 3 + Math.random() * 3,
          color: newPhase === 3 ? '#ff2222' : '#ff6644', type: 'boss_charge',
        });
      }

      this.damageFlash = 0.1;
      this.triggerScreenShake(8, 0.4);

      if (newPhase >= 2) {
        for (let i = 0; i < 12; i++) {
          this.state.particles.push({
            pos: { x: bx + (Math.random() - 0.5) * 30, y: by + (Math.random() - 0.5) * 20 },
            vel: { x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80 },
            lifetime: 2, maxLifetime: 2, size: 3 + Math.random() * 3,
            color: '#aa2233', type: 'death_chunk',
            rotation: Math.random() * 6, rotationSpeed: (Math.random() - 0.5) * 8,
          });
        }
      }
    }

    if (boss.phaseTransition > 0) {
      boss.phaseTransition -= dt;
      return;
    }

    boss.chargeCooldown -= dt;
    boss.comboCooldown -= dt;
    boss.roarTimer -= dt;

    // Dispatch to boss-specific AI
    switch (bossCreature.spriteType) {
      case 'rotjaw':
        this.updateBossRotjaw(dt, bossCreature, dist, dx, dy);
        break;
      case 'tangle':
        this.updateBossTangle(dt, bossCreature, dist, dx, dy);
        break;
      case 'subject_zero':
        this.updateBossSubjectZero(dt, bossCreature, dist, dx, dy);
        break;
    }
  }

  updateBossRotjaw(dt: number, bossCreature: Creature, dist: number, dx: number, dy: number) {
    const boss = this.state.boss;
    const p = this.state.player;
    const speedMult = boss.phase === 3 ? 1.5 : boss.phase === 2 ? 1.2 : 1;
    bossCreature.speed = 70 * speedMult;

    // CHARGE ATTACK
    if (boss.isCharging) {
      boss.chargeTimer -= dt;
      bossCreature.vel.x = boss.chargeDir.x * 180 * speedMult;
      bossCreature.vel.y = boss.chargeDir.y * 180 * speedMult;
      if (Math.random() < 0.5) {
        this.state.particles.push({
          pos: { x: bossCreature.pos.x + bossCreature.width / 2, y: bossCreature.pos.y + bossCreature.height / 2 },
          vel: { x: -boss.chargeDir.x * 30 + (Math.random() - 0.5) * 20, y: -boss.chargeDir.y * 30 + (Math.random() - 0.5) * 20 },
          lifetime: 0.6, maxLifetime: 0.6, size: 3,
          color: '#ff4422', type: 'boss_charge',
        });
      }
      if (dist < 40 && p.invincible <= 0) {
        const chargeDmg = Math.floor(bossCreature.damage * 1.5);
        const defense = this.getStatBonus('defense');
        const finalDmg = Math.max(1, Math.floor((chargeDmg - defense) * (1 - this.getGearDamageReduction())));
        this.dealDamageToPlayer(finalDmg, boss.chargeDir.x * 150, boss.chargeDir.y * 80);
      }
      if (boss.chargeTimer <= 0) {
        boss.isCharging = false;
        boss.chargeCooldown = boss.phase === 3 ? 2 : boss.phase === 2 ? 3 : 4;
      }
      return;
    }

    if (boss.chargeCooldown <= 0 && dist < 300 && dist > 60) {
      const nd = dist || 1;
      boss.chargeDir = { x: dx / nd, y: dy / nd };
      boss.isCharging = true;
      boss.chargeTimer = 0.6;
      boss.chargeCooldown = 5;
      for (let i = 0; i < 8; i++) {
        this.state.particles.push({
          pos: { x: bossCreature.pos.x + bossCreature.width / 2, y: bossCreature.pos.y + bossCreature.height / 2 },
          vel: { x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 40 },
          lifetime: 0.4, maxLifetime: 0.4, size: 2,
          color: '#ffaa22', type: 'boss_charge',
        });
      }
      return;
    }

    // BITE COMBO (Phase 2+)
    if (boss.phase >= 2 && boss.comboCooldown <= 0 && dist < bossCreature.attackRange * 1.5) {
      const comboHits = boss.phase === 3 ? 3 : 2;
      for (let hit = 0; hit < comboHits; hit++) {
        setTimeout(() => {
          if (bossCreature.state === 'dead') return;
          const cdx = p.pos.x - bossCreature.pos.x;
          const cdy = p.pos.y - bossCreature.pos.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cdist < bossCreature.attackRange * 2 && p.invincible <= 0) {
            const defense = this.getStatBonus('defense');
            const dmg = Math.max(1, Math.floor((bossCreature.damage * 0.8 - defense) * (1 - this.getGearDamageReduction())));
            this.dealDamageToPlayer(dmg, 0, 0);
          }
        }, hit * 300);
      }
      boss.comboCooldown = boss.phase === 3 ? 2.5 : 4;
    }

    // Phase 3: acid projectiles
    if (boss.phase === 3 && bossCreature.rangedCooldown <= 0 && dist < 250) {
      for (let i = -1; i <= 1; i++) {
        const angle = Math.atan2(dy, dx) + i * 0.25;
        this.state.projectiles.push({
          pos: { x: bossCreature.pos.x + bossCreature.width / 2, y: bossCreature.pos.y + bossCreature.height / 2 },
          vel: { x: Math.cos(angle) * 120, y: Math.sin(angle) * 120 },
          width: 8, height: 8, damage: Math.floor(bossCreature.damage * 0.5),
          lifetime: 2, fromPlayer: false, type: 'acid',
        });
      }
      bossCreature.rangedCooldown = 2;
    }
  }

  updateBossTangle(dt: number, bossCreature: Creature, dist: number, dx: number, dy: number) {
    const boss = this.state.boss;
    const p = this.state.player;
    bossCreature.speed = 30;

    // Phase 1: Tentacle slams targeting player position + ink clouds
    if (boss.comboCooldown <= 0 && dist < 200) {
      // Tentacle slam — spawn damage projectiles at player position
      for (let i = 0; i < (boss.phase >= 2 ? 3 : 2); i++) {
        const offset = (i - 1) * 30;
        setTimeout(() => {
          if (bossCreature.state === 'dead') return;
          this.state.projectiles.push({
            pos: { x: p.pos.x + offset, y: bossCreature.pos.y },
            vel: { x: 0, y: 100 },
            width: 12, height: 40, damage: bossCreature.damage,
            lifetime: 0.8, fromPlayer: false, type: 'acid',
          });
          this.triggerScreenShake(3, 0.15);
        }, i * 400);
      }
      boss.comboCooldown = boss.phase === 3 ? 2 : boss.phase === 2 ? 3 : 4;
    }

    // Ink cloud area denial
    if (boss.chargeCooldown <= 0 && dist < 250) {
      // Spawn ink cloud particles (damage zone)
      const cx = bossCreature.pos.x + bossCreature.width / 2 + (Math.random() - 0.5) * 100;
      const cy = bossCreature.pos.y + bossCreature.height / 2;
      for (let i = 0; i < 10; i++) {
        this.state.particles.push({
          pos: { x: cx + (Math.random() - 0.5) * 30, y: cy + (Math.random() - 0.5) * 30 },
          vel: { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 },
          lifetime: 3, maxLifetime: 3, size: 5 + Math.random() * 5,
          color: '#110822', type: 'corruption',
        });
      }
      boss.chargeCooldown = boss.phase === 3 ? 3 : 5;
    }

    // Phase 2: Two sweeping tentacle projectiles
    if (boss.phase >= 2 && bossCreature.rangedCooldown <= 0) {
      for (let side = -1; side <= 1; side += 2) {
        this.state.projectiles.push({
          pos: { x: bossCreature.pos.x + bossCreature.width / 2 + side * 20, y: bossCreature.pos.y + bossCreature.height / 2 },
          vel: { x: side * 60, y: 0 },
          width: 30, height: 6, damage: Math.floor(bossCreature.damage * 0.6),
          lifetime: 3, fromPlayer: false, type: 'acid',
        });
      }
      bossCreature.rangedCooldown = boss.phase === 3 ? 2 : 4;
    }

    // Phase 3: Ink fills arena — reduced visibility handled in render
  }

  updateBossSubjectZero(dt: number, bossCreature: Creature, dist: number, dx: number, dy: number) {
    const boss = this.state.boss;
    const p = this.state.player;
    const speedMult = boss.phase === 3 ? 1.6 : boss.phase === 2 ? 1.3 : 1;
    bossCreature.speed = 65 * speedMult;

    // Erratic movement — jitter
    if (Math.random() < 0.1) {
      bossCreature.vel.x += (Math.random() - 0.5) * 80;
      bossCreature.vel.y += (Math.random() - 0.5) * 60;
    }

    // Phase 1: Erratic charges + acid spit volleys
    if (boss.chargeCooldown <= 0 && dist < 250 && dist > 40) {
      const nd = dist || 1;
      boss.chargeDir = { x: dx / nd, y: dy / nd };
      boss.isCharging = true;
      boss.chargeTimer = 0.4;
      boss.chargeCooldown = boss.phase === 3 ? 1.5 : 3;

      bossCreature.vel.x = boss.chargeDir.x * 200 * speedMult;
      bossCreature.vel.y = boss.chargeDir.y * 200 * speedMult;

      // Charge trail
      for (let i = 0; i < 6; i++) {
        this.state.particles.push({
          pos: { x: bossCreature.pos.x + bossCreature.width / 2, y: bossCreature.pos.y + bossCreature.height / 2 },
          vel: { x: (Math.random() - 0.5) * 50, y: (Math.random() - 0.5) * 50 },
          lifetime: 0.5, maxLifetime: 0.5, size: 2,
          color: '#ff6644', type: 'boss_charge',
        });
      }
    }

    if (boss.isCharging) {
      boss.chargeTimer -= dt;
      if (dist < 35 && p.invincible <= 0) {
        const defense = this.getStatBonus('defense');
        const dmg = Math.max(1, Math.floor((bossCreature.damage - defense) * (1 - this.getGearDamageReduction())));
        this.dealDamageToPlayer(dmg, boss.chargeDir.x * 120, boss.chargeDir.y * 80);
      }
      if (boss.chargeTimer <= 0) boss.isCharging = false;
    }

    // Acid spit volleys
    if (bossCreature.rangedCooldown <= 0 && dist < 200) {
      const volleys = boss.phase >= 2 ? 5 : 3;
      for (let i = 0; i < volleys; i++) {
        const spread = (i - Math.floor(volleys / 2)) * 0.2;
        const angle = Math.atan2(dy, dx) + spread;
        this.state.projectiles.push({
          pos: { x: bossCreature.pos.x + bossCreature.width / 2, y: bossCreature.pos.y + bossCreature.height / 2 },
          vel: { x: Math.cos(angle) * 100, y: Math.sin(angle) * 100 },
          width: 6, height: 6, damage: Math.floor(bossCreature.damage * 0.4),
          lifetime: 2, fromPlayer: false, type: 'acid',
        });
      }
      bossCreature.rangedCooldown = boss.phase === 3 ? 1.5 : 3;
    }

    // Phase 2: Core beam — sweep projectile
    if (boss.phase >= 2 && boss.comboCooldown <= 0 && dist < 200) {
      // Fire a continuous line of projectiles
      const beamAngle = Math.atan2(dy, dx);
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          if (bossCreature.state === 'dead') return;
          const sweepAngle = beamAngle + (i - 4) * 0.15;
          this.state.projectiles.push({
            pos: { x: bossCreature.pos.x + bossCreature.width / 2, y: bossCreature.pos.y + bossCreature.height / 2 },
            vel: { x: Math.cos(sweepAngle) * 150, y: Math.sin(sweepAngle) * 150 },
            width: 4, height: 4, damage: Math.floor(bossCreature.damage * 0.3),
            lifetime: 1.5, fromPlayer: false, type: 'shock',
          });
        }, i * 100);
      }
      boss.comboCooldown = boss.phase === 3 ? 4 : 6;
    }

    // Mimic player movement briefly
    if (boss.phase >= 1 && Math.random() < 0.02) {
      bossCreature.vel.x = p.vel.x * 0.8;
      bossCreature.vel.y = p.vel.y * 0.8;
    }
  }

  dealDamageToPlayer(dmg: number, knockX: number, knockY: number) {
    const p = this.state.player;
    p.hp -= dmg;
    p.invincible = 0.5;
    if (knockX || knockY) {
      p.vel.x += knockX;
      p.vel.y += knockY;
    }
    this.spawnDamageParticles(p.pos.x + p.width / 2, p.pos.y + p.height / 2, false);
    this.spawnDamageNumber(p.pos.x + p.width / 2, p.pos.y, dmg, '#ff4444');
    this.triggerScreenShake(4, 0.2);
    this.damageFlash = 0.15;
    this.helmetCracks = Math.min(5, Math.floor((1 - p.hp / p.maxHp) * 5));
    if (p.hp <= 0) {
      this.state.gameOver = true;
      this.deathActive = true;
      this.deathSequence = 0;
      this.callbacks.onPlayerDeath();
    }
  }

  updateMemoryFragments(dt: number) {
    const p = this.state.player;
    this.state.memoryFragments = this.state.memoryFragments.filter(mf => {
      if (mf.collected) {
        mf.collectTimer -= dt;
        return mf.collectTimer > 0;
      }

      mf.vel.y *= 0.98;
      mf.pos.y += mf.vel.y * dt;
      mf.lifetime -= dt;
      mf.bobOffset += dt;

      // Pickup check
      const dx = p.pos.x + p.width / 2 - mf.pos.x;
      const dy = p.pos.y + p.height / 2 - mf.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 30) {
        mf.collected = true;
        mf.collectTimer = 0.5;
        this.state.memoryCollected = { title: mf.title, text: mf.text };
        this.callbacks.onMemoryFragment(mf.title, mf.text);
        // Collection particles
        for (let i = 0; i < 20; i++) {
          this.state.particles.push({
            pos: { ...mf.pos },
            vel: { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 60 },
            lifetime: 1.5, maxLifetime: 1.5, size: 2 + Math.random() * 2,
            color: Math.random() > 0.5 ? '#cc88ff' : '#ffffff', type: 'memory',
          });
        }
        return true;
      }

      return mf.lifetime > 0;
    });
  }

  updateCreatures(dt: number) {
    const p = this.state.player;
    for (const c of this.state.creatures) {
      // Animation
      c.animTimer += dt;
      c.corruptionPulse += dt * 2;
      if (c.animTimer > 0.15) {
        c.animFrame = (c.animFrame + 1) % 4;
        c.animTimer = 0;
      }

      // Poison DOT
      if (c.poisonTimer > 0 && c.state !== 'dead') {
        c.poisonTimer -= dt;
        const tickInterval = 0.5;
        if (Math.floor((c.poisonTimer + dt) / tickInterval) > Math.floor(c.poisonTimer / tickInterval)) {
          c.hp -= c.poisonDamage;
          this.spawnDamageNumber(c.pos.x + c.width / 2, c.pos.y, c.poisonDamage, '#44ff44');
          // Poison drip particles
          this.state.particles.push({
            pos: { x: c.pos.x + c.width / 2, y: c.pos.y + c.height / 2 },
            vel: { x: (Math.random() - 0.5) * 20, y: -15 - Math.random() * 10 },
            lifetime: 0.6, maxLifetime: 0.6, size: 2,
            color: '#44ff44', type: 'poison',
          });
          if (c.hp <= 0) this.killCreature(c);
        }
        if (c.poisonTimer <= 0) { c.poisonTimer = 0; c.poisonDamage = 0; }
      }

      if (c.state === 'dead') {
        c.deathTimer -= dt;

        // Animate dead creature movement (sinking, drifting)
        if (c.spriteType === 'shark' || c.spriteType === 'rotjaw') {
          c.pos.y += 12 * dt; // sink
          c.pos.x += c.vel.x * dt * 0.5;
          c.vel.x *= 0.98;
        } else if (c.spriteType === 'jelly') {
          // Float upward briefly then fade
          c.pos.y -= 5 * dt;
        }

        if (c.deathTimer <= 0) {
          if (c.id.startsWith('boss_')) continue;
          const x = p.pos.x + (Math.random() > 0.5 ? 1 : -1) * (500 + Math.random() * 400);
          const clampedX = Math.max(50, Math.min(WORLD_W - 50, x));
          const tx = Math.floor(clampedX);
          c.pos = { x: clampedX, y: this.state.terrain[Math.min(tx, this.state.terrain.length - 1)] - 50 - Math.random() * 100 };
          c.patrolOrigin = { ...c.pos };
          c.hp = c.maxHp;
          c.state = 'patrol';
          c.vel = { x: 0, y: 0 };
        }
        continue;
      }

      const dx = p.pos.x - c.pos.x;
      const dy = p.pos.y - c.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      c.attackCooldown -= dt;
      c.rangedCooldown -= dt;

      const stealthReduction = 1 - this.state.skills.levels.stealth * 0.1;
      const detectRange = (c.behavior === 'ambush' ? 80 : 160) * stealthReduction;
      
      if (dist < detectRange && c.behavior !== 'patrol') {
        c.state = 'chase';
      } else if (c.state === 'chase' && dist > detectRange * 1.5) {
        c.state = 'patrol';
      }

      if (c.state === 'patrol') {
        const pdx = c.patrolOrigin.x - c.pos.x;
        if (Math.abs(pdx) > c.patrolRange) c.facing = pdx > 0 ? 1 : -1;
        c.vel.x += c.facing * c.speed * 2 * dt;
        c.vel.y += Math.sin(this.state.time * 2 + c.pos.x) * 10 * dt;
      } else if (c.state === 'chase') {
        const nd = dist || 1;
        c.vel.x += (dx / nd) * c.speed * 3 * dt;
        c.vel.y += (dy / nd) * c.speed * 3 * dt;
        c.facing = dx > 0 ? 1 : -1;

        if (dist < c.attackRange && c.attackCooldown <= 0 && p.invincible <= 0) {
          const defense = this.getStatBonus('defense');
          const dmg = Math.max(1, Math.floor((c.damage - defense) * (1 - this.getGearDamageReduction())));
          p.hp -= dmg;
          p.invincible = 0.5;
          c.attackCooldown = 1;
          this.spawnDamageParticles(p.pos.x + p.width / 2, p.pos.y + p.height / 2, false);
          this.spawnDamageNumber(p.pos.x + p.width / 2, p.pos.y, dmg, '#ff4444');
          this.triggerScreenShake(3, 0.15);
          this.damageFlash = 0.12;
          this.helmetCracks = Math.min(5, Math.floor((1 - p.hp / p.maxHp) * 5));
          if (p.hp <= 0) {
            this.state.gameOver = true;
            this.deathActive = true;
            this.deathSequence = 0;
            this.callbacks.onPlayerDeath();
          }
        }

        if (c.rangedAttack && dist < 200 && dist > 50 && c.rangedCooldown <= 0) {
          const nd2 = dist || 1;
          let projSpeed = 100;
          if (c.rangedAttack === 'shock') projSpeed = 80;

          this.state.projectiles.push({
            pos: { x: c.pos.x + c.width / 2, y: c.pos.y + c.height / 2 },
            vel: { x: (dx / nd2) * projSpeed, y: (dy / nd2) * projSpeed },
            width: 6, height: 6, damage: Math.floor(c.damage * 0.7),
            lifetime: 2, fromPlayer: false, type: c.rangedAttack,
          });
          c.rangedCooldown = 2 + Math.random();
        }
      }

      c.vel.x *= 1 - 3 * dt;
      c.vel.y *= 1 - 3 * dt;
      const spd = Math.sqrt(c.vel.x ** 2 + c.vel.y ** 2);
      if (spd > c.speed) {
        c.vel.x = (c.vel.x / spd) * c.speed;
        c.vel.y = (c.vel.y / spd) * c.speed;
      }

      c.pos.x += c.vel.x * dt;
      c.pos.y += c.vel.y * dt;
      c.pos.x = Math.max(5, Math.min(WORLD_W - 5, c.pos.x));
      c.pos.y = Math.max(10, Math.min(WORLD_H - 30, c.pos.y));
      const ctx2 = Math.floor(Math.max(0, Math.min(c.pos.x, this.state.terrain.length - 1)));
      if (c.pos.y + c.height > this.state.terrain[ctx2]) {
        c.pos.y = this.state.terrain[ctx2] - c.height;
        c.vel.y = -Math.abs(c.vel.y) * 0.3;
      }

      // Corruption particles
      if (Math.random() < 0.03) {
        this.state.particles.push({
          pos: { x: c.pos.x + Math.random() * c.width, y: c.pos.y + Math.random() * c.height },
          vel: { x: (Math.random() - 0.5) * 8, y: -5 - Math.random() * 5 },
          lifetime: 1, maxLifetime: 1, size: 1 + Math.random(),
          color: c.spriteType === 'jelly' ? '#8866ff44' : '#44ff4444', type: 'corruption',
        });
      }
    }
  }

  updateDroppedItems(dt: number) {
    const p = this.state.player;
    this.state.droppedItems = this.state.droppedItems.filter(di => {
      di.vel.y += GRAVITY * 0.5 * dt;
      di.vel.x *= 1 - 2 * dt;
      di.vel.y *= 1 - 2 * dt;
      di.pos.x += di.vel.x * dt;
      di.pos.y += di.vel.y * dt;
      di.lifetime -= dt;

      const tx = Math.floor(Math.max(0, Math.min(di.pos.x, this.state.terrain.length - 1)));
      if (di.pos.y > this.state.terrain[tx] - 6) {
        di.pos.y = this.state.terrain[tx] - 6;
        di.vel.y = 0;
      }

      const dx = p.pos.x + p.width / 2 - di.pos.x;
      const dy = p.pos.y + p.height / 2 - di.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 24) {
        this.addToInventory(di.item, di.count);
        this.callbacks.onItemPickup(di.item, di.count);
        for (let i = 0; i < 5; i++) {
          this.state.particles.push({
            pos: { ...di.pos },
            vel: { x: (Math.random() - 0.5) * 40, y: -20 - Math.random() * 20 },
            lifetime: 0.5, maxLifetime: 0.5, size: 2 + Math.random(),
            color: RARITY_COLORS[di.item.rarity], type: 'pickup',
          });
        }
        return false;
      }

      return di.lifetime > 0;
    });
  }

  addToInventory(item: ItemDef, count: number) {
    const p = this.state.player;
    if (item.stackable) {
      for (const slot of p.inventory) {
        if (slot && slot.item.id === item.id && slot.count < item.maxStack) {
          const canAdd = Math.min(count, item.maxStack - slot.count);
          slot.count += canAdd;
          count -= canAdd;
          if (count <= 0) return;
        }
      }
      for (const slot of p.quickslots) {
        if (slot && slot.item.id === item.id && slot.count < item.maxStack) {
          const canAdd = Math.min(count, item.maxStack - slot.count);
          slot.count += canAdd;
          count -= canAdd;
          if (count <= 0) return;
        }
      }
    }
    if (count > 0) {
      for (let i = 0; i < p.inventory.length; i++) {
        if (!p.inventory[i]) {
          p.inventory[i] = { item, count };
          return;
        }
      }
    }
  }

  updateAirBubbles(dt: number) {
    const p = this.state.player;
    for (const ab of this.state.airBubbles) {
      if (!ab.active) {
        ab.respawnTimer -= dt;
        if (ab.respawnTimer <= 0) ab.active = true;
        continue;
      }
      const dx = p.pos.x + p.width / 2 - ab.pos.x;
      const dy = p.pos.y + p.height / 2 - ab.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < ab.size + 12) {
        p.oxygen = Math.min(p.maxOxygen, p.oxygen + p.maxOxygen * 0.3);
        ab.active = false;
        ab.respawnTimer = 20 + Math.random() * 10;
        // "+30% O₂" floating text
        this.state.particles.push({
          pos: { x: p.pos.x + p.width / 2, y: p.pos.y - 5 },
          vel: { x: 0, y: -30 },
          lifetime: 1.2, maxLifetime: 1.2, size: 10,
          color: '#66ddff', type: 'pickup_text',
        });
        for (let i = 0; i < 8; i++) {
          this.state.particles.push({
            pos: { ...ab.pos },
            vel: { x: (Math.random() - 0.5) * 35, y: -18 - Math.random() * 18 },
            lifetime: 0.7, maxLifetime: 0.7, size: 2 + Math.random() * 3,
            color: '#66ddff', type: 'bubble',
          });
        }
      }
    }
  }

  updateParticles(dt: number) {
    this.state.particles = this.state.particles.filter(p => {
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.lifetime -= dt;
      if (p.type === 'bubble') p.vel.y -= 10 * dt;
      if (p.type === 'corruption') { p.vel.y -= 3 * dt; p.size *= 0.995; }
      if (p.type === 'death_chunk') { p.vel.y += 20 * dt; p.vel.x *= 0.98; }
      if (p.type === 'spark') { p.vel.x *= 0.95; p.vel.y *= 0.95; }
      if (p.type === 'shockwave') { /* stationary, size grows via render */ }
      if (p.type === 'wake') { p.vel.x *= 0.9; p.vel.y *= 0.9; p.size *= 1.02; }
      if (p.type === 'ripple') { p.size += 40 * dt; }
      return p.lifetime > 0;
    });
  }

  spawnAmbientParticles(dt: number) {
    // Ambient bubbles from terrain
    if (Math.random() < 3 * dt) {
      const x = this.state.camera.x + Math.random() * GAME_W;
      const tx = Math.floor(Math.max(0, Math.min(x, this.state.terrain.length - 1)));
      this.state.particles.push({
        pos: { x, y: this.state.terrain[tx] - Math.random() * 5 },
        vel: { x: (Math.random() - 0.5) * 5, y: -8 - Math.random() * 12 },
        lifetime: 4 + Math.random() * 4, maxLifetime: 8, size: 1 + Math.random() * 2.5,
        color: 'rgba(100, 200, 255, 0.3)', type: 'bubble',
      });
    }
    // Bioluminescent specks
    if (Math.random() < 2 * dt) {
      this.state.particles.push({
        pos: {
          x: this.state.camera.x + Math.random() * GAME_W,
          y: this.state.camera.y + Math.random() * GAME_H,
        },
        vel: { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
        lifetime: 3 + Math.random() * 4, maxLifetime: 7, size: 1 + Math.random(),
        color: Math.random() > 0.5 ? '#44ffaa' : '#44aaff', type: 'glow',
      });
    }
    // Zone-specific ambient particles
    const zone = this.state.depthZone;
    
    // Zone 0: Shallows — plankton, leaf debris
    if (zone === 0) {
      if (Math.random() < 2 * dt) {
        this.state.particles.push({
          pos: { x: this.state.camera.x + Math.random() * GAME_W, y: this.state.camera.y + Math.random() * GAME_H },
          vel: { x: (Math.random() - 0.5) * 3, y: -1 + Math.random() * 0.5 },
          lifetime: 5 + Math.random() * 3, maxLifetime: 8, size: 0.5 + Math.random(),
          color: 'rgba(180, 220, 200, 0.3)', type: 'glow',
        });
      }
    }
    // Zone 1: Kelp — glowing green spores spiraling
    if (zone === 1) {
      if (Math.random() < 3 * dt) {
        const x = this.state.camera.x + Math.random() * GAME_W;
        this.state.particles.push({
          pos: { x, y: this.state.camera.y + Math.random() * GAME_H },
          vel: { x: Math.sin(x * 0.01) * 4, y: Math.cos(x * 0.01) * 2 },
          lifetime: 4 + Math.random() * 3, maxLifetime: 7, size: 1 + Math.random(),
          color: '#44ff8855', type: 'glow',
        });
      }
    }
    // Zone 2: Labs — sparks, dust motes, chemical drips
    if (zone === 2) {
      if (Math.random() < 1.5 * dt) {
        this.state.particles.push({
          pos: { x: this.state.camera.x + Math.random() * GAME_W, y: this.state.camera.y + 10 + Math.random() * 30 },
          vel: { x: (Math.random() - 0.5) * 10, y: 8 + Math.random() * 6 },
          lifetime: 0.5 + Math.random() * 0.5, maxLifetime: 1, size: 1,
          color: Math.random() > 0.5 ? '#ffcc4488' : '#88ff8844', type: 'glow',
        });
      }
      // Dust motes in light beams
      if (Math.random() < 1 * dt) {
        this.state.particles.push({
          pos: { x: this.state.camera.x + Math.random() * GAME_W, y: this.state.camera.y + Math.random() * GAME_H },
          vel: { x: (Math.random() - 0.5) * 2, y: 0.5 + Math.random() },
          lifetime: 6 + Math.random() * 4, maxLifetime: 10, size: 0.5,
          color: 'rgba(200, 200, 180, 0.2)', type: 'glow',
        });
      }
    }
    // Zone 3: Abyss — slow falling ash, rare light flickers
    if (zone === 3) {
      if (Math.random() < 0.5 * dt) {
        this.state.particles.push({
          pos: { x: this.state.camera.x + Math.random() * GAME_W, y: this.state.camera.y },
          vel: { x: (Math.random() - 0.5) * 1, y: 3 + Math.random() * 2 },
          lifetime: 8 + Math.random() * 5, maxLifetime: 13, size: 0.5 + Math.random() * 0.5,
          color: 'rgba(80, 80, 100, 0.3)', type: 'glow',
        });
      }
    }
    // Zone 4: Core — corruption bursts, heat shimmer, orbiting debris
    if (zone >= 4) {
      if (Math.random() < 3 * dt) {
        this.state.particles.push({
          pos: { x: this.state.camera.x + Math.random() * GAME_W, y: this.state.camera.y + GAME_H - Math.random() * 60 },
          vel: { x: (Math.random() - 0.5) * 8, y: -10 - Math.random() * 8 },
          lifetime: 1.5 + Math.random() * 1.5, maxLifetime: 3, size: 1.5 + Math.random(),
          color: '#ff224488', type: 'corruption',
        });
      }
      // Heat shimmer rising
      if (Math.random() < 2 * dt) {
        this.state.particles.push({
          pos: { x: this.state.camera.x + Math.random() * GAME_W, y: this.state.camera.y + GAME_H },
          vel: { x: (Math.random() - 0.5) * 3, y: -15 - Math.random() * 10 },
          lifetime: 2, maxLifetime: 2, size: 2,
          color: 'rgba(255, 60, 30, 0.08)', type: 'glow',
        });
      }
    }
    // Corruption specks in deep zones (3+)
    if (zone >= 3 && Math.random() < 1 * dt) {
      this.state.particles.push({
        pos: { x: this.state.camera.x + Math.random() * GAME_W, y: this.state.camera.y + Math.random() * GAME_H },
        vel: { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 3 },
        lifetime: 2 + Math.random() * 2, maxLifetime: 4, size: 1.5,
        color: zone >= 4 ? '#ff224488' : '#8844ff44', type: 'corruption',
      });
    }
  }

  updateCamera() {
    const p = this.state.player;
    const targetX = p.pos.x - GAME_W / 2 + p.width / 2;
    const targetY = p.pos.y - GAME_H / 2 + p.height / 2;
    this.state.camera.x += (targetX - this.state.camera.x) * 0.08;
    this.state.camera.y += (targetY - this.state.camera.y) * 0.08;
    this.state.camera.x = Math.max(0, Math.min(WORLD_W - GAME_W, this.state.camera.x));
    this.state.camera.y = Math.max(0, Math.min(WORLD_H - GAME_H, this.state.camera.y));
  }

  triggerScreenShake(intensity: number, duration: number) {
    if (intensity > this.screenShake.intensity) {
      this.screenShake = { intensity, duration, timer: duration };
    }
  }

  updateScreenShake(dt: number) {
    if (this.screenShake.timer > 0) {
      this.screenShake.timer -= dt;
      if (this.screenShake.timer <= 0) {
        this.screenShake.intensity = 0;
      }
    }
    if (this.damageFlash > 0) this.damageFlash -= dt;
  }

  updateDeathSequence(dt: number) {
    this.deathSequence += dt;
    // Slow ambient particles
    this.updateParticles(dt * 0.5);
  }

  getScreenShakeOffset(): Vec2 {
    if (this.screenShake.timer <= 0) return { x: 0, y: 0 };
    const t = this.screenShake.timer / this.screenShake.duration;
    const i = this.screenShake.intensity * t;
    return {
      x: Math.round((Math.random() - 0.5) * i * 2),
      y: Math.round((Math.random() - 0.5) * i * 2),
    };
  }

  aabb(a: { pos: Vec2; width: number; height: number }, b: { pos: Vec2; width: number; height: number }) {
    return a.pos.x < b.pos.x + b.width && a.pos.x + a.width > b.pos.x &&
      a.pos.y < b.pos.y + b.height && a.pos.y + a.height > b.pos.y;
  }

  spawnDamageParticles(x: number, y: number, isCrit: boolean) {
    const count = isCrit ? 10 : 5;
    for (let i = 0; i < count; i++) {
      this.state.particles.push({
        pos: { x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10 },
        vel: { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 60 },
        lifetime: 0.5, maxLifetime: 0.5, size: isCrit ? 3 : 2,
        color: isCrit ? '#ffdd44' : '#ff4444', type: 'damage',
      });
    }
  }

  spawnDamageNumber(x: number, y: number, damage: number, color: string, prefix = '-') {
    this.state.particles.push({
      pos: { x: x + (Math.random() - 0.5) * 16, y: y - 10 },
      vel: { x: (Math.random() - 0.5) * 20, y: -40 - Math.random() * 20 },
      lifetime: 1.0, maxLifetime: 1.0, size: damage >= 20 ? 12 : 10,
      color, type: 'damage_text',
      text: `${prefix}${damage}`,
    });
  }

  // ================ RENDERING ================

  render() {
    const ctx = this.ctx;
    const shake = this.getScreenShakeOffset();
    const cam = { x: this.state.camera.x + shake.x, y: this.state.camera.y + shake.y };
    ctx.imageSmoothingEnabled = false;

    // Death sequence desaturation
    if (this.deathActive && this.deathSequence > 1.5) {
      ctx.filter = `grayscale(${Math.min(1, (this.deathSequence - 1.5) * 0.5) * 100}%)`;
    }

    this.renderBackground(ctx, cam);
    this.renderParallaxLayers(ctx, cam);
    this.renderTerrain(ctx, cam);
    this.renderCorruptionTendrils(ctx, cam);
    this.renderWaterCurrents(ctx, cam);
    this.renderKelp(ctx, cam);
    this.renderRocks(ctx, cam);
    this.renderAirBubbles(ctx, cam);
    this.renderDroppedItems(ctx, cam);
    this.renderMemoryFragments(ctx, cam);
    this.renderCreatures(ctx, cam);
    this.renderCreatureDeathAnims(ctx, cam);
    this.renderBossHPBar(ctx);
    this.renderNPCs(ctx, cam);
    this.renderPlayer(ctx, cam);
    this.renderProjectiles(ctx, cam);
    this.renderParticles(ctx, cam);
    this.renderHelmetLight(ctx, cam);
    this.renderLightRays(ctx, cam);
    this.renderDarknessOverlay(ctx, cam);
    this.renderWaterDistortion(ctx);
    this.renderVignette(ctx);
    this.renderDamageVignette(ctx);
    this.renderHelmetCracks(ctx);
    this.renderZoneOverlay(ctx);
    this.renderPressureEffect(ctx);

    ctx.filter = 'none';

    // Boss intro cinematic overlay
    if (this.bossIntroActive) {
      this.renderBossIntro(ctx, cam);
    }

    // Zone transition overlay
    if (this.zoneTransitionTimer > 0) {
      this.renderZoneTransition(ctx);
    }

    // Dialogue overlay
    if (this.state.activeDialogue) {
      this.renderDialogueOverlay(ctx);
    }

    // Death sequence overlay
    if (this.deathActive) {
      this.renderDeathOverlay(ctx);
    }
  }

  renderBackground(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const zone = this.state.depthZone;
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_H);
    const depthFactor = cam.y / WORLD_H;

    // Zone-based color palettes
    const zoneColors = [
      // Shallows - blue-green with light
      { top: [15, 45, 75], bot: [8, 28, 55] },
      // Kelp Forests - murky green
      { top: [10, 35, 30], bot: [5, 22, 20] },
      // Sunken Labs - industrial blue-grey
      { top: [12, 28, 45], bot: [6, 15, 30] },
      // Abyssal - near black
      { top: [4, 8, 18], bot: [2, 3, 8] },
      // Core - dark with red tint
      { top: [15, 5, 10], bot: [5, 2, 4] },
    ];

    const zc = zoneColors[Math.min(zone, 4)];
    grad.addColorStop(0, `rgb(${zc.top[0]}, ${zc.top[1]}, ${zc.top[2]})`);
    grad.addColorStop(1, `rgb(${zc.bot[0]}, ${zc.bot[1]}, ${zc.bot[2]})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
  }

  renderParallaxLayers(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const zone = this.state.depthZone;

    // Layer 1: Far distant - slow parallax (0.15x)
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = zone >= 3 ? '#0a0512' : '#0a1520';
    for (let x = 0; x < GAME_W; x += 3) {
      const wx = x + cam.x * 0.15;
      const h = 40 + Math.sin(wx * 0.003) * 20 + Math.sin(wx * 0.009) * 10;
      ctx.fillRect(x, GAME_H - h, 3, h);
    }

    // Layer 2: Mid-distance formations (0.3x)
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = zone >= 4 ? '#150818' : zone >= 2 ? '#0c1828' : '#0a1830';
    for (let x = 0; x < GAME_W; x += 2) {
      const wx = x + cam.x * 0.3;
      const h = 55 + Math.sin(wx * 0.005) * 25 + Math.sin(wx * 0.015) * 12;
      ctx.fillRect(x, GAME_H - h, 2, h);
    }
    // Silhouettes on layer 2
    if (zone <= 1) {
      // Coral silhouettes
      for (let i = 0; i < 8; i++) {
        const bx = ((i * 130 + cam.x * 0.3) % (GAME_W + 100)) - 50;
        const bh = 20 + Math.sin(i * 2.3) * 15;
        ctx.fillRect(bx, GAME_H - 55 - bh, 6, bh);
        ctx.fillRect(bx - 3, GAME_H - 55 - bh + 5, 12, 4);
      }
    }
    if (zone >= 3) {
      // Ghost silhouettes of massive creatures in the distance
      ctx.globalAlpha = 0.08;
      const ghostX = ((this.state.time * 8 + cam.x * 0.1) % (GAME_W + 200)) - 100;
      ctx.fillStyle = '#8888ff';
      // Large creature outline
      ctx.beginPath();
      ctx.ellipse(ghostX, GAME_H * 0.4, 60, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tail
      ctx.fillRect(ghostX + 50, GAME_H * 0.4 - 5, 30, 10);
    }

    // Layer 3: Near background (0.6x)
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = zone >= 4 ? '#180a20' : '#0c1a28';
    for (let x = 0; x < GAME_W; x += 2) {
      const wx = x + cam.x * 0.6;
      const h = 70 + Math.sin(wx * 0.007) * 30 + Math.sin(wx * 0.02) * 15;
      ctx.fillRect(x, GAME_H - h, 2, h);
    }
    // Seaweed/debris on layer 3
    if (zone <= 2) {
      for (let i = 0; i < 12; i++) {
        const sx = ((i * 85 + cam.x * 0.6) % (GAME_W + 60)) - 30;
        const sway = Math.sin(this.state.time * 1.2 + i) * 3;
        ctx.fillStyle = zone === 1 ? '#1a3a2a55' : '#1a2a3a55';
        for (let j = 0; j < 5; j++) {
          ctx.fillRect(sx + sway * (j / 5), GAME_H - 70 - j * 6, 2, 6);
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  renderTerrain(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const startX = Math.floor(cam.x);
    const endX = Math.min(startX + GAME_W + 1, this.state.terrain.length);
    const zone = this.state.depthZone;

    // Main terrain fill
    const terrainColors = ['#0c1a28', '#0a1820', '#101825', '#08080f', '#120810'];
    ctx.fillStyle = terrainColors[Math.min(zone, 4)];
    ctx.beginPath();
    ctx.moveTo(0, GAME_H);
    for (let x = startX; x < endX; x++) {
      ctx.lineTo(x - cam.x, this.state.terrain[x] - cam.y);
    }
    ctx.lineTo(endX - cam.x, GAME_H);
    ctx.closePath();
    ctx.fill();

    // Surface detail - texture line
    const surfaceColors = ['#182838', '#152520', '#1a2530', '#0e0e18', '#1a1015'];
    ctx.fillStyle = surfaceColors[Math.min(zone, 4)];
    for (let x = startX; x < endX; x += 2) {
      const ty = this.state.terrain[x] - cam.y;
      ctx.fillRect(x - cam.x, ty, 2, 4);
    }

    // Scattered detail pixels on terrain surface
    ctx.fillStyle = zone >= 3 ? '#161622' : '#1c2c3c';
    for (let x = startX; x < endX; x += 5) {
      const ty = this.state.terrain[x] - cam.y;
      if ((x * 7) % 11 < 4) {
        ctx.fillRect(x - cam.x, ty + 2, 3, 2);
      }
      if ((x * 13) % 17 < 3) {
        ctx.fillRect(x - cam.x + 1, ty + 5, 2, 3);
      }
    }

    // Zone 2: Lab elements (pipes, terminals)
    if (zone === 2) {
      for (let x = startX; x < endX; x += 40) {
        const ty = this.state.terrain[x] - cam.y;
        // Pipe
        ctx.fillStyle = '#2a3040';
        ctx.fillRect(x - cam.x, ty - 15, 3, 15);
        // Terminal glow
        if ((x * 3) % 80 < 20) {
          const flicker = Math.sin(this.state.time * 4 + x) > 0 ? 0.6 : 0.2;
          ctx.fillStyle = `rgba(100, 255, 100, ${flicker})`;
          ctx.fillRect(x - cam.x - 1, ty - 18, 5, 3);
        }
      }
    }

    // Zone 4: Corruption spreading on walls
    if (zone >= 4) {
      ctx.fillStyle = `rgba(180, 30, 30, ${0.15 + Math.sin(this.state.time * 1.5) * 0.05})`;
      for (let x = startX; x < endX; x += 8) {
        const ty = this.state.terrain[x] - cam.y;
        const spread = Math.sin(x * 0.03 + this.state.time * 0.5) * 6;
        ctx.fillRect(x - cam.x, ty - Math.abs(spread), 4, Math.abs(spread) + 2);
      }
    }
  }

  renderKelp(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const k of this.state.kelp) {
      const sx = k.x - cam.x;
      if (sx < -15 || sx > GAME_W + 15) continue;
      const baseY = this.state.terrain[Math.min(Math.floor(k.x), this.state.terrain.length - 1)] - cam.y;
      const sway = Math.sin(this.state.time * 1.2 + k.phase) * 5;

      // Kelp stem with gradient opacity
      for (let i = 0; i < k.height; i += 3) {
        const t = i / k.height;
        const swayAmt = t * sway;
        const g = Math.floor(60 + t * 40);
        ctx.fillStyle = `rgba(26, ${g}, 42, ${0.8 - t * 0.3})`;
        ctx.fillRect(sx + swayAmt, baseY - i - 3, 3, 4);
        // Leaf fronds
        if (i % 12 < 3 && i > 10) {
          ctx.fillRect(sx + swayAmt + 3, baseY - i - 2, 4, 2);
          ctx.fillRect(sx + swayAmt - 4, baseY - i, 4, 2);
        }
      }
      // Glowing tip with halo
      const tipSway = sway;
      const tipGlow = 0.4 + Math.sin(this.state.time * 2.5 + k.phase) * 0.25;
      ctx.fillStyle = `rgba(60, 255, 120, ${tipGlow})`;
      ctx.fillRect(sx + tipSway - 1, baseY - k.height - 3, 4, 4);
      // Halo
      ctx.fillStyle = `rgba(60, 255, 120, ${tipGlow * 0.15})`;
      ctx.fillRect(sx + tipSway - 4, baseY - k.height - 6, 10, 10);
    }
  }

  renderRocks(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const r of this.state.rocks) {
      const sx = r.x - cam.x;
      if (sx < -25 || sx > GAME_W + 25) continue;
      const sy = r.y - cam.y;
      // Rock body with shading
      ctx.fillStyle = '#1a2838';
      ctx.fillRect(sx - r.size / 2, sy - r.size, r.size, r.size);
      // Highlight
      ctx.fillStyle = '#223848';
      ctx.fillRect(sx - r.size / 2, sy - r.size, r.size * 0.6, r.size * 0.4);
      // Shadow edge
      ctx.fillStyle = '#101820';
      ctx.fillRect(sx + r.size / 2 - 2, sy - r.size * 0.6, 2, r.size * 0.6);
    }
  }

  renderAirBubbles(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const ab of this.state.airBubbles) {
      if (!ab.active) continue;
      const sx = ab.pos.x - cam.x;
      const sy = ab.pos.y - cam.y;
      if (sx < -15 || sx > GAME_W + 15) continue;

      const pulse = 1 + Math.sin(this.state.time * 3) * 0.2;
      const r = ab.size * pulse;

      // Outer glow
      ctx.fillStyle = 'rgba(100, 220, 255, 0.06)';
      ctx.beginPath();
      ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
      ctx.fill();

      // Middle glow
      ctx.fillStyle = 'rgba(100, 220, 255, 0.12)';
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Bubble
      ctx.strokeStyle = 'rgba(100, 220, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(100, 220, 255, 0.2)';
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(200, 240, 255, 0.5)';
      ctx.fillRect(sx - r * 0.3, sy - r * 0.5, 2, 2);
    }
  }

  renderDroppedItems(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const di of this.state.droppedItems) {
      const sx = di.pos.x - cam.x;
      const sy = di.pos.y - cam.y + Math.sin(this.state.time * 3 + di.bobOffset) * 3;
      if (sx < -15 || sx > GAME_W + 15) continue;

      const color = RARITY_COLORS[di.item.rarity];

      // Outer glow
      ctx.fillStyle = color + '22';
      ctx.fillRect(sx - 6, sy - 6, 12, 12);

      // Inner glow
      ctx.fillStyle = color + '55';
      ctx.fillRect(sx - 4, sy - 4, 8, 8);

      // Item core
      ctx.fillStyle = color;
      ctx.fillRect(sx - 3, sy - 3, 6, 6);

      // Sparkle effects for uncommon+
      if (di.item.rarity !== 'common') {
        const sparkPhase = this.state.time * 5 + di.bobOffset;
        if (Math.sin(sparkPhase) > 0.3) {
          ctx.fillStyle = color + 'bb';
          ctx.fillRect(sx - 1, sy - 7, 1, 3);
          ctx.fillRect(sx + 3, sy - 4, 3, 1);
          ctx.fillRect(sx - 4, sy + 1, 3, 1);
          ctx.fillRect(sx, sy + 4, 1, 3);
        }
      }
    }
  }

  renderCreatures(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const c of this.state.creatures) {
      if (c.state === 'dead') continue;
      const sx = c.pos.x - cam.x;
      const sy = c.pos.y - cam.y;
      if (sx < -50 || sx > GAME_W + 50) continue;

      ctx.save();
      ctx.translate(sx + c.width / 2, sy + c.height / 2);
      if (c.facing < 0) ctx.scale(-1, 1);

      // Corruption aura
      const auraPulse = Math.sin(c.corruptionPulse) * 0.15 + 0.1;
      const auraColor = c.spriteType === 'jelly' ? `rgba(100, 80, 255, ${auraPulse})` :
        c.spriteType === 'shark' ? `rgba(255, 40, 40, ${auraPulse})` :
          `rgba(80, 255, 80, ${auraPulse})`;
      ctx.fillStyle = auraColor;
      ctx.fillRect(-c.width / 2 - 3, -c.height / 2 - 3, c.width + 6, c.height + 6);

      // Hit stagger — brief pause visual
      if (c.hp < c.maxHp && c.hp > 0) {
        const dmgPct = 1 - c.hp / c.maxHp;
        // Corruption cracks on body — expand with damage
        if (dmgPct > 0.3) {
          const crackAlpha = Math.min(0.8, dmgPct);
          ctx.fillStyle = `rgba(255, 60, 40, ${crackAlpha * 0.4})`;
          const crackCount = Math.floor(dmgPct * 5);
          for (let i = 0; i < crackCount; i++) {
            const cx2 = -c.width / 2 + ((i * 7 + 3) % c.width);
            ctx.fillRect(cx2, -c.height / 2 + 2, 1, c.height - 4);
          }
        }
      }

      this.drawCreatureSprite(ctx, c);
      ctx.restore();

      // HP bar
      if (c.hp < c.maxHp) {
        const barW = c.width + 4;
        const hpPct = c.hp / c.maxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(sx - 2, sy - 7, barW, 4);
        ctx.fillStyle = hpPct > 0.5 ? '#44cc66' : hpPct > 0.25 ? '#ccaa22' : '#cc2222';
        ctx.fillRect(sx - 1, sy - 6, (barW - 2) * hpPct, 2);
      }
    }
  }

  drawCreatureSprite(ctx: CanvasRenderingContext2D, c: Creature) {
    const w = c.width / 2;
    const h = c.height / 2;
    const bob = Math.sin(this.state.time * 3 + c.pos.x) * 1.5;
    const frame = c.animFrame;
    const corruptGlow = Math.sin(c.corruptionPulse) * 0.3 + 0.7;

    switch (c.spriteType) {
      case 'fish': {
        // Body with corruption texture
        ctx.fillStyle = '#884466';
        ctx.fillRect(-w, -h + bob, w * 2 - 4, h * 2);
        // Lighter belly
        ctx.fillStyle = '#995577';
        ctx.fillRect(-w + 2, 0 + bob, w * 2 - 6, h - 2);
        // Corruption veins
        ctx.fillStyle = `rgba(255, 80, 80, ${corruptGlow * 0.5})`;
        ctx.fillRect(-w + 3, -h + 3 + bob, 1, h);
        ctx.fillRect(-w + 7, -h + 5 + bob, 1, h - 4);
        // Dorsal fin
        ctx.fillStyle = '#773355';
        ctx.fillRect(-w + 4, -h - 3 + bob, 6, 4);
        // Tail with movement
        const tailSwing = Math.sin(this.state.time * 6 + c.pos.x) * 2;
        ctx.fillStyle = '#773355';
        ctx.fillRect(-w - 5, -h + 2 + bob + tailSwing, 5, h * 2 - 4);
        // Glowing eye
        ctx.fillStyle = `rgba(255, 60, 60, ${corruptGlow})`;
        ctx.fillRect(w - 5, -h + 3 + bob, 3, 3);
        // Eye glow
        ctx.fillStyle = `rgba(255, 60, 60, ${corruptGlow * 0.2})`;
        ctx.fillRect(w - 7, -h + 1 + bob, 7, 7);
        // Mutation: oversized jaw
        ctx.fillStyle = '#663344';
        ctx.fillRect(w - 6, h - 4 + bob, 5, 4);
        ctx.fillStyle = '#ffcccc';
        ctx.fillRect(w - 5, h - 3 + bob, 1, 2);
        ctx.fillRect(w - 3, h - 3 + bob, 1, 2);
        break;
      }

      case 'eel': {
        // Segmented body with wave motion
        const segments = 6;
        for (let i = 0; i < segments; i++) {
          const segBob = Math.sin(this.state.time * 4 + i * 0.7) * 3;
          const t = i / segments;
          const segW = 5 + (1 - Math.abs(t - 0.3)) * 3;
          ctx.fillStyle = `rgb(${50 + t * 20}, ${90 + t * 30}, ${50 + t * 20})`;
          ctx.fillRect(-w + i * (w * 2 / segments), -h / 2 + segBob, segW, h);
          // Corruption cracks
          if (i % 2 === 0) {
            ctx.fillStyle = `rgba(100, 255, 100, ${corruptGlow * 0.6})`;
            ctx.fillRect(-w + i * (w * 2 / segments) + 2, -h / 2 + segBob + 1, 1, h - 2);
          }
        }
        // Head
        ctx.fillStyle = '#4a7a4a';
        ctx.fillRect(w - 6, -h / 2, 6, h);
        // Glowing eyes
        ctx.fillStyle = `rgba(100, 255, 50, ${corruptGlow})`;
        ctx.fillRect(w - 4, -h / 2 + 2, 2, 2);
        // Acid drip
        if (frame % 3 === 0) {
          ctx.fillStyle = '#66ff4488';
          ctx.fillRect(w - 3, h / 2, 2, 3);
        }
        break;
      }

      case 'jelly': {
        const jBob = Math.sin(this.state.time * 2) * 3;
        // Bell/dome - translucent
        ctx.fillStyle = `rgba(120, 100, 255, ${0.4 + corruptGlow * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(0, -h / 2 + jBob, w - 1, h * 0.6, 0, Math.PI, 0);
        ctx.fill();
        // Inner pattern
        ctx.fillStyle = `rgba(150, 130, 255, ${0.3})`;
        ctx.fillRect(-w / 2, -h + 3 + jBob, w, 3);
        // Glowing core
        ctx.fillStyle = `rgba(180, 160, 255, ${corruptGlow * 0.5})`;
        ctx.fillRect(-3, -h / 2 + jBob, 6, 4);
        // Tentacles with sway
        ctx.fillStyle = `rgba(100, 80, 255, ${0.3 + corruptGlow * 0.15})`;
        for (let i = 0; i < 5; i++) {
          const tBob = Math.sin(this.state.time * 2.5 + i * 1.2) * 3;
          const tx = -w + 3 + i * ((w * 2 - 6) / 4);
          ctx.fillRect(tx, h * 0.2 + jBob, 1, 6 + tBob);
          // Tentacle tips glow
          ctx.fillStyle = `rgba(160, 140, 255, ${corruptGlow * 0.4})`;
          ctx.fillRect(tx, h * 0.2 + jBob + 6 + tBob, 2, 2);
          ctx.fillStyle = `rgba(100, 80, 255, ${0.3 + corruptGlow * 0.15})`;
        }
        // Bio-electric sparks
        if (frame % 4 === 0) {
          ctx.fillStyle = `rgba(200, 200, 255, ${corruptGlow * 0.8})`;
          ctx.fillRect(-w + frame * 3, -h / 2 + jBob + 2, 2, 2);
        }
        // Glow halo
        ctx.fillStyle = `rgba(120, 100, 255, ${0.06})`;
        ctx.fillRect(-w - 5, -h - 5 + jBob, w * 2 + 10, h * 2 + 10);
        break;
      }

      case 'crab': {
        // Shell with texture
        ctx.fillStyle = '#885533';
        ctx.fillRect(-w + 3, -h + 3 + bob, w * 2 - 6, h * 2 - 4);
        // Shell pattern
        ctx.fillStyle = '#996644';
        ctx.fillRect(-w + 5, -h + 5 + bob, w * 2 - 10, h - 4);
        // Shell edge highlight
        ctx.fillStyle = '#aa7755';
        ctx.fillRect(-w + 3, -h + 3 + bob, w * 2 - 6, 2);
        // Corruption crack
        ctx.fillStyle = `rgba(255, 180, 0, ${corruptGlow * 0.5})`;
        ctx.fillRect(-2, -h + 4 + bob, 1, h - 2);
        ctx.fillRect(3, -h + 6 + bob, 1, h - 4);
        // Claws with animation
        const clawOpen = Math.sin(this.state.time * 3 + c.pos.x) > 0.5 ? 2 : 0;
        ctx.fillStyle = '#aa6644';
        ctx.fillRect(-w - 4, -h + 4 + bob, 5, 6);
        ctx.fillRect(-w - 5, -h + 3 + bob - clawOpen, 3, 3);
        ctx.fillRect(w - 1, -h + 4 + bob, 5, 6);
        ctx.fillRect(w + 2, -h + 3 + bob - clawOpen, 3, 3);
        // Legs
        ctx.fillStyle = '#774422';
        for (let i = 0; i < 3; i++) {
          const legBob = Math.sin(this.state.time * 4 + i) * 1;
          ctx.fillRect(-w + 5 + i * 5, h - 2 + bob + legBob, 2, 4);
          ctx.fillRect(w - 7 - i * 5, h - 2 + bob + legBob, 2, 4);
        }
        // Glowing eyes on stalks
        ctx.fillStyle = '#664411';
        ctx.fillRect(-w + 5, -h - 2 + bob, 2, 4);
        ctx.fillRect(w - 7, -h - 2 + bob, 2, 4);
        ctx.fillStyle = `rgba(255, 170, 0, ${corruptGlow})`;
        ctx.fillRect(-w + 5, -h - 3 + bob, 3, 3);
        ctx.fillRect(w - 8, -h - 3 + bob, 3, 3);
        break;
      }

      case 'shark': {
        // Large detailed shark body
        ctx.fillStyle = '#556070';
        ctx.fillRect(-w, -h + bob, w * 2, h * 2);
        // Lighter underbelly
        ctx.fillStyle = '#667580';
        ctx.fillRect(-w + 2, h * 0.3 + bob, w * 2 - 4, h * 0.7 - 2);
        // Dorsal fin
        ctx.fillStyle = '#445060';
        ctx.fillRect(-3, -h - 6 + bob, 8, 7);
        // Tail
        const tailSwing = Math.sin(this.state.time * 5) * 3;
        ctx.fillStyle = '#445060';
        ctx.fillRect(-w - 10, -h + 3 + bob + tailSwing, 12, h * 2 - 6);
        ctx.fillRect(-w - 14, -h + bob + tailSwing, 6, 4);
        ctx.fillRect(-w - 14, h - 4 + bob + tailSwing, 6, 4);
        // Corruption: split jaw
        ctx.fillStyle = '#443038';
        ctx.fillRect(w - 8, h * 0.2 + bob, 10, h * 0.4);
        ctx.fillRect(w - 8, h * 0.6 + bob + 2, 10, h * 0.4 - 2);
        // Teeth
        ctx.fillStyle = '#ccbbaa';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(w - 6 + i * 3, h * 0.55 + bob, 1, 3);
          ctx.fillRect(w - 6 + i * 3, h * 0.2 + bob + 2, 1, -3);
        }
        // Corruption veins
        ctx.fillStyle = `rgba(255, 40, 40, ${corruptGlow * 0.6})`;
        ctx.fillRect(-w + 5, -h + 5 + bob, 1, h);
        ctx.fillRect(-w + 12, -h + 3 + bob, 1, h * 1.5);
        ctx.fillRect(w - 15, -h + 7 + bob, 1, h);
        // Armored dorsal with black coral
        ctx.fillStyle = '#222228';
        ctx.fillRect(-5, -h - 4 + bob, 4, 3);
        ctx.fillRect(1, -h - 3 + bob, 3, 2);
        // Glowing red eye
        ctx.fillStyle = `rgba(255, 30, 30, ${corruptGlow})`;
        ctx.fillRect(w - 6, -h + 4 + bob, 4, 4);
        ctx.fillStyle = `rgba(255, 30, 30, ${corruptGlow * 0.2})`;
        ctx.fillRect(w - 8, -h + 2 + bob, 8, 8);
        // Torn skin showing glowing muscle
        ctx.fillStyle = `rgba(255, 100, 80, ${corruptGlow * 0.4})`;
        ctx.fillRect(-w + 8, -h + 8 + bob, 6, 3);
        ctx.fillRect(w - 18, h * 0.1 + bob, 4, 5);
        break;
      }

      case 'rotjaw': {
        // ROTJAW BOSS — massive corrupted shark with split jaw
        const boss = this.state.boss;
        const phaseColor = boss.phase === 3 ? '#cc2222' : boss.phase === 2 ? '#aa4433' : '#556070';
        const phaseGlow = boss.phase === 3 ? 0.8 : boss.phase === 2 ? 0.5 : 0.3;

        // Main body — larger and more menacing
        ctx.fillStyle = phaseColor;
        ctx.fillRect(-w, -h + bob, w * 2, h * 2);
        // Armored plates
        ctx.fillStyle = '#333840';
        ctx.fillRect(-w + 2, -h + 2 + bob, w * 2 - 4, 4);
        ctx.fillRect(-w + 4, -h + 8 + bob, w * 2 - 8, 3);
        // Lighter underbelly
        ctx.fillStyle = '#667580';
        ctx.fillRect(-w + 3, h * 0.3 + bob, w * 2 - 6, h * 0.7 - 3);

        // Massive dorsal fin with black coral fusion
        ctx.fillStyle = '#222228';
        ctx.fillRect(-5, -h - 10 + bob, 12, 12);
        ctx.fillStyle = '#111118';
        ctx.fillRect(-3, -h - 12 + bob, 8, 5);
        // Coral growths on dorsal
        ctx.fillStyle = '#1a1a22';
        ctx.fillRect(5, -h - 8 + bob, 4, 3);
        ctx.fillRect(-7, -h - 6 + bob, 3, 4);

        // Tail with power
        const tailSwing = Math.sin(this.state.time * 5) * 4;
        ctx.fillStyle = '#445060';
        ctx.fillRect(-w - 14, -h + 3 + bob + tailSwing, 16, h * 2 - 6);
        ctx.fillRect(-w - 20, -h + bob + tailSwing, 8, 5);
        ctx.fillRect(-w - 20, h - 5 + bob + tailSwing, 8, 5);

        // SPLIT JAW — signature feature
        const jawOpen = boss.active ? 3 + Math.sin(this.state.time * 4) * 2 : 1;
        // Upper jaw
        ctx.fillStyle = '#443038';
        ctx.fillRect(w - 10, -h + 2 + bob - jawOpen, 14, h - 2);
        // Lower jaw
        ctx.fillRect(w - 10, h * 0.1 + bob + jawOpen, 14, h - 2);
        // Teeth — upper
        ctx.fillStyle = '#eeddcc';
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(w - 8 + i * 3, h * 0.1 + bob - jawOpen - 1, 1, 4);
        }
        // Teeth — lower
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(w - 8 + i * 3, h * 0.1 + bob + jawOpen - 2, 1, 4);
        }
        // Dripping from jaw
        if (frame % 3 === 0) {
          ctx.fillStyle = `rgba(255, 60, 30, 0.6)`;
          ctx.fillRect(w - 4, h * 0.1 + bob + jawOpen + h - 2, 2, 4 + Math.random() * 3);
        }

        // Corruption veins — glowing
        ctx.fillStyle = `rgba(255, 40, 40, ${corruptGlow * phaseGlow})`;
        ctx.fillRect(-w + 5, -h + 5 + bob, 2, h * 1.5);
        ctx.fillRect(-w + 14, -h + 3 + bob, 2, h * 1.8);
        ctx.fillRect(w - 20, -h + 7 + bob, 2, h * 1.2);
        ctx.fillRect(-w + 8, h * 0.2 + bob, w, 1);

        // Torn skin revealing glowing muscle
        ctx.fillStyle = `rgba(255, 100, 80, ${corruptGlow * 0.6})`;
        ctx.fillRect(-w + 10, -h + 10 + bob, 8, 4);
        ctx.fillRect(w - 25, h * 0.15 + bob, 6, 6);

        // Glowing red eyes — INTENSE
        ctx.fillStyle = `rgba(255, 20, 20, ${corruptGlow})`;
        ctx.fillRect(w - 8, -h + 4 + bob, 5, 5);
        // Eye glow halo
        ctx.fillStyle = `rgba(255, 20, 20, ${corruptGlow * 0.3})`;
        ctx.fillRect(w - 12, -h + bob, 13, 13);

        // Phase 2+: corruption spreading visuals
        if (boss.phase >= 2) {
          ctx.fillStyle = `rgba(180, 30, 30, ${0.2 + Math.sin(this.state.time * 3) * 0.1})`;
          ctx.fillRect(-w - 3, -h - 3 + bob, w * 2 + 6, h * 2 + 6);
        }
        // Phase 3: rage aura
        if (boss.phase === 3) {
          ctx.fillStyle = `rgba(255, 0, 0, ${0.1 + Math.sin(this.state.time * 6) * 0.05})`;
          ctx.fillRect(-w - 8, -h - 8 + bob, w * 2 + 16, h * 2 + 16);
        }

        // Charging visual
        if (boss.isCharging) {
          ctx.fillStyle = `rgba(255, 150, 50, ${0.4 + Math.sin(this.state.time * 15) * 0.2})`;
          ctx.fillRect(-w - 5, -h - 5 + bob, w * 2 + 10, h * 2 + 10);
        }
        break;
      }

      case 'clownfish': {
        // Small fast clownfish — orange/white striped
        ctx.fillStyle = '#ee7733';
        ctx.fillRect(-w, -h + bob, w * 2 - 2, h * 2);
        // White stripes
        ctx.fillStyle = '#ffddbb';
        ctx.fillRect(-w + 3, -h + bob, 3, h * 2);
        ctx.fillRect(w - 6, -h + bob, 3, h * 2);
        // Dorsal fin
        ctx.fillStyle = '#cc5522';
        ctx.fillRect(-2, -h - 2 + bob, 4, 3);
        // Tail
        const tailSwing = Math.sin(this.state.time * 8 + c.pos.x) * 2;
        ctx.fillStyle = '#cc5522';
        ctx.fillRect(-w - 3, -h + 1 + bob + tailSwing, 4, h * 2 - 2);
        // Corruption eye
        ctx.fillStyle = `rgba(255, 40, 40, ${corruptGlow})`;
        ctx.fillRect(w - 4, -h + 2 + bob, 2, 2);
        break;
      }

      case 'anglerfish': {
        // Large mouth anglerfish with bioluminescent lure
        ctx.fillStyle = '#2a3540';
        ctx.fillRect(-w, -h + bob, w * 2, h * 2);
        // Huge jaw
        ctx.fillStyle = '#1a2530';
        ctx.fillRect(w - 8, -h + h * 0.4 + bob, 10, h);
        // Teeth
        ctx.fillStyle = '#ccbbaa';
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(w - 6 + i * 2, -h + h * 0.35 + bob, 1, 3);
          ctx.fillRect(w - 6 + i * 2, h * 0.4 + bob, 1, -3);
        }
        // Bioluminescent lure
        const lureGlow = 0.5 + Math.sin(this.state.time * 3) * 0.3;
        ctx.fillStyle = `rgba(100, 255, 200, ${lureGlow})`;
        const lureX = -3;
        const lureY = -h - 6 + bob + Math.sin(this.state.time * 2) * 2;
        ctx.fillRect(lureX, lureY, 4, 4);
        // Lure stalk
        ctx.fillStyle = '#445566';
        ctx.fillRect(lureX + 1, lureY + 4, 1, 6);
        // Lure glow halo
        ctx.fillStyle = `rgba(100, 255, 200, ${lureGlow * 0.15})`;
        ctx.fillRect(lureX - 4, lureY - 4, 12, 12);
        // Tiny angry eyes
        ctx.fillStyle = `rgba(255, 200, 50, ${corruptGlow})`;
        ctx.fillRect(w - 10, -h + 4 + bob, 2, 2);
        break;
      }

      case 'sea_snake': {
        // Long, sinuous serpent
        const segs = 8;
        for (let i = 0; i < segs; i++) {
          const segBob = Math.sin(this.state.time * 5 + i * 0.9) * 4;
          const t = i / segs;
          const segW = 4 + (1 - Math.abs(t - 0.4)) * 3;
          const g = Math.floor(40 + t * 30);
          ctx.fillStyle = `rgb(${g}, ${100 + g}, ${50 + g})`;
          ctx.fillRect(-w + i * (w * 2 / segs), -h / 2 + segBob, segW, h);
          // Iridescent scale pattern
          if (i % 2 === 0) {
            ctx.fillStyle = `rgba(150, 255, 180, ${corruptGlow * 0.3})`;
            ctx.fillRect(-w + i * (w * 2 / segs) + 1, -h / 2 + segBob + 1, 2, h - 2);
          }
        }
        // Head with fangs
        ctx.fillStyle = '#5a8a5a';
        ctx.fillRect(w - 5, -h / 2, 5, h);
        ctx.fillStyle = `rgba(200, 255, 100, ${corruptGlow})`;
        ctx.fillRect(w - 3, -h / 2 + 1, 2, 2);
        // Fangs
        ctx.fillStyle = '#eeddcc';
        ctx.fillRect(w - 2, h / 2 - 1, 1, 3);
        ctx.fillRect(w - 4, h / 2 - 1, 1, 3);
        break;
      }

      case 'mantis_shrimp': {
        // Compact, armored, powerful claws
        ctx.fillStyle = '#44aa77';
        ctx.fillRect(-w + 2, -h + bob, w * 2 - 4, h * 2);
        // Color bands
        ctx.fillStyle = '#ee5533';
        ctx.fillRect(-w + 4, -h + 3 + bob, w * 2 - 8, 3);
        ctx.fillStyle = '#3388cc';
        ctx.fillRect(-w + 4, h - 4 + bob, w * 2 - 8, 3);
        // Massive hammer claws
        const clawSwing = Math.sin(this.state.time * 6 + c.pos.x) > 0.7 ? 3 : 0;
        ctx.fillStyle = '#cc3322';
        ctx.fillRect(w - 2, -h + bob - clawSwing, 6, 6);
        ctx.fillRect(w - 2, h - 6 + bob + clawSwing, 6, 6);
        // Eyes on stalks
        ctx.fillStyle = '#2288aa';
        ctx.fillRect(-w + 2, -h - 4 + bob, 3, 5);
        ctx.fillRect(w - 5, -h - 4 + bob, 3, 5);
        ctx.fillStyle = `rgba(50, 200, 255, ${corruptGlow})`;
        ctx.fillRect(-w + 2, -h - 5 + bob, 3, 3);
        ctx.fillRect(w - 5, -h - 5 + bob, 3, 3);
        break;
      }

      case 'squid': {
        // Streamlined squid body
        const sqBob = Math.sin(this.state.time * 2.5) * 2;
        ctx.fillStyle = `rgba(180, 80, 120, ${0.6 + corruptGlow * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(0, -h * 0.2 + sqBob, w - 2, h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Mantle point
        ctx.fillStyle = '#aa5577';
        ctx.fillRect(-3, -h + sqBob, 6, 5);
        // Tentacles
        ctx.fillStyle = `rgba(160, 60, 100, ${0.5 + corruptGlow * 0.15})`;
        for (let i = 0; i < 6; i++) {
          const tBob = Math.sin(this.state.time * 3 + i * 1.1) * 3;
          const tx2 = -w + 3 + i * ((w * 2 - 6) / 5);
          ctx.fillRect(tx2, h * 0.1 + sqBob, 2, 8 + tBob);
        }
        // Large eyes
        ctx.fillStyle = `rgba(255, 180, 50, ${corruptGlow})`;
        ctx.fillRect(-w + 3, -h * 0.3 + sqBob, 4, 4);
        ctx.fillRect(w - 7, -h * 0.3 + sqBob, 4, 4);
        break;
      }

      case 'kelp_lurker': {
        // Looks like kelp until it attacks — tall, thin, plant-like
        const sway = Math.sin(this.state.time * 1.2 + c.pos.x) * 3;
        const reveal = c.state === 'chase' || c.state === 'attack' ? 1 : 0.3;
        // Kelp-like body
        for (let i = 0; i < 6; i++) {
          const t = i / 6;
          const segSway = sway * t;
          ctx.fillStyle = `rgba(30, ${70 + t * 30}, 40, ${0.6 + reveal * 0.3})`;
          ctx.fillRect(-w / 2 + segSway, -h + i * (h * 2 / 6), w, h * 2 / 6 + 1);
        }
        // When aggressive: reveal red eyes and tendrils
        if (reveal > 0.5) {
          ctx.fillStyle = `rgba(255, 50, 50, ${corruptGlow})`;
          ctx.fillRect(-3, -h * 0.3, 3, 3);
          ctx.fillRect(2, -h * 0.3, 3, 3);
          // Thorned tendrils
          ctx.fillStyle = `rgba(200, 50, 30, ${corruptGlow * 0.5})`;
          ctx.fillRect(-w / 2 - 4, -h * 0.1, 3, 6);
          ctx.fillRect(w / 2 + 1, -h * 0.1, 3, 6);
        }
        break;
      }

      case 'lab_rat': {
        // Tiny, fast, corrupted lab rat
        ctx.fillStyle = '#887766';
        ctx.fillRect(-w, -h + bob, w * 2, h * 2);
        // Darker back
        ctx.fillStyle = '#776655';
        ctx.fillRect(-w, -h + bob, w * 2, h);
        // Tail
        const ratTail = Math.sin(this.state.time * 8 + c.pos.x) * 2;
        ctx.fillStyle = '#aa8877';
        ctx.fillRect(-w - 4, -1 + bob + ratTail, 5, 1);
        // Eyes — red corruption
        ctx.fillStyle = `rgba(255, 40, 40, ${corruptGlow})`;
        ctx.fillRect(w - 3, -h + 1 + bob, 2, 2);
        // Whiskers
        ctx.fillStyle = '#998877';
        ctx.fillRect(w - 1, -h + 2 + bob, 3, 1);
        ctx.fillRect(w - 1, -h + 4 + bob, 3, 1);
        break;
      }

      case 'specimen': {
        // Warped lab specimen — asymmetric, unsettling
        ctx.fillStyle = '#6a4a5a';
        ctx.fillRect(-w, -h + bob, w * 2, h * 2);
        // Mutation lumps
        ctx.fillStyle = '#8a5a6a';
        ctx.fillRect(-w + 2, -h + 2 + bob, w, h);
        ctx.fillRect(w - w + 5, h * 0.2 + bob, w - 3, h - 2);
        // Exposed muscle/corruption
        ctx.fillStyle = `rgba(255, 80, 60, ${corruptGlow * 0.6})`;
        ctx.fillRect(-w + 4, -h + 6 + bob, 6, 4);
        ctx.fillRect(w - 8, h * 0.1 + bob, 4, 6);
        // Multiple mismatched eyes
        ctx.fillStyle = `rgba(255, 200, 50, ${corruptGlow})`;
        ctx.fillRect(w - 5, -h + 3 + bob, 3, 3);
        ctx.fillStyle = `rgba(255, 50, 50, ${corruptGlow})`;
        ctx.fillRect(w - 8, -h + 7 + bob, 2, 2);
        ctx.fillRect(w - 3, -h + 8 + bob, 2, 2);
        // Vestigial limbs
        ctx.fillStyle = '#5a3a4a';
        ctx.fillRect(-w - 3, h * 0.1 + bob, 4, 3);
        ctx.fillRect(w, -h + h * 0.5 + bob, 4, 3);
        break;
      }

      case 'drone': {
        // Security drone — mechanical, angular
        ctx.fillStyle = '#556677';
        ctx.fillRect(-w, -h + bob, w * 2, h * 2);
        // Metal plating
        ctx.fillStyle = '#667788';
        ctx.fillRect(-w + 1, -h + 1 + bob, w * 2 - 2, 3);
        ctx.fillRect(-w + 1, h - 3 + bob, w * 2 - 2, 3);
        // Sensor eye — red scanning
        const scanX = Math.sin(this.state.time * 4) * (w - 4);
        ctx.fillStyle = `rgba(255, 30, 30, ${0.6 + Math.sin(this.state.time * 6) * 0.3})`;
        ctx.fillRect(scanX - 2, -2 + bob, 4, 4);
        // Scanner beam
        ctx.fillStyle = `rgba(255, 30, 30, 0.1)`;
        ctx.fillRect(scanX - 1, h / 2 + bob, 2, 20);
        // Thrusters
        ctx.fillStyle = '#444455';
        ctx.fillRect(-w - 2, -h + 3 + bob, 3, h - 2);
        ctx.fillRect(w - 1, -h + 3 + bob, 3, h - 2);
        // Thruster glow
        if (Math.abs(c.vel.x) > 5 || Math.abs(c.vel.y) > 5) {
          ctx.fillStyle = `rgba(100, 150, 255, ${0.3 + Math.random() * 0.2})`;
          ctx.fillRect(-w - 3, -2 + bob, 2, 4);
          ctx.fillRect(w + 1, -2 + bob, 2, 4);
        }
        break;
      }

      case 'corrupted_diver': {
        // Twisted mirror of the player — deeply unsettling
        const dBob = Math.sin(this.state.time * 1.5 + c.pos.x) * 2;
        // Body — tattered dive suit
        ctx.fillStyle = '#2a3040';
        ctx.fillRect(-5, -5 + dBob, 10, 14);
        // Corruption has warped the suit
        ctx.fillStyle = `rgba(120, 40, 40, ${corruptGlow * 0.4})`;
        ctx.fillRect(-4, -3 + dBob, 8, 4);
        // Helmet — cracked visor
        ctx.fillStyle = '#556677';
        ctx.fillRect(-4, -h + dBob, 8, 7);
        // Cracked visor — dark inside
        ctx.fillStyle = '#223344';
        ctx.fillRect(-2, -h + 2 + dBob, 5, 4);
        // Single glowing eye through cracked visor
        ctx.fillStyle = `rgba(255, 100, 40, ${corruptGlow})`;
        ctx.fillRect(0, -h + 3 + dBob, 2, 2);
        // Arms — reaching out
        ctx.fillStyle = '#334455';
        const armReach = c.state === 'chase' ? 4 : 0;
        ctx.fillRect(4, -3 + dBob, 4 + armReach, 3);
        // Legs — limp
        ctx.fillStyle = '#2a3040';
        ctx.fillRect(-3, 9 + dBob, 3, 5);
        ctx.fillRect(1, 9 + dBob, 3, 6);
        // Corruption tendrils from suit
        ctx.fillStyle = `rgba(180, 30, 30, ${corruptGlow * 0.5})`;
        ctx.fillRect(-6, -2 + dBob, 2, 8);
        ctx.fillRect(5, 0 + dBob, 2, 6);
        break;
      }

      case 'overflow': {
        // Liquid corruption entity — amorphous, seeping
        const overflowT = this.state.time * 2 + c.pos.x;
        ctx.fillStyle = `rgba(80, 20, 40, ${0.6 + corruptGlow * 0.2})`;
        // Amorphous blob shape
        for (let i = 0; i < 5; i++) {
          const blobX = -w + i * (w * 2 / 4);
          const blobH = h + Math.sin(overflowT + i * 1.5) * 3;
          ctx.fillRect(blobX, -blobH / 2, w * 2 / 4 + 1, blobH);
        }
        // Glowing corruption veins
        ctx.fillStyle = `rgba(255, 40, 60, ${corruptGlow * 0.7})`;
        ctx.fillRect(-w + 3, -2, 1, 4);
        ctx.fillRect(0, -3, 1, 6);
        ctx.fillRect(w - 4, -1, 1, 3);
        // Dripping tendrils below
        for (let i = 0; i < 3; i++) {
          const dripLen = 3 + Math.sin(overflowT + i * 2) * 2;
          ctx.fillStyle = `rgba(100, 20, 30, ${0.5 + Math.sin(overflowT + i) * 0.2})`;
          ctx.fillRect(-w + 4 + i * 8, h / 2, 2, dripLen);
        }
        // No distinct eyes — just a pulsing core
        ctx.fillStyle = `rgba(255, 80, 80, ${corruptGlow * 0.4})`;
        ctx.fillRect(-2, -2, 4, 4);
        break;
      }

      case 'tangle': {
        // THE TANGLE — colossal corrupted octopus boss
        const boss = this.state.boss;
        const phase = boss.creatureId === c.id ? boss.phase : 1;
        const phaseGlow = phase === 3 ? 0.8 : phase === 2 ? 0.5 : 0.3;

        // Central body mass — armored with absorbed shells
        ctx.fillStyle = '#443350';
        ctx.beginPath();
        ctx.ellipse(0, -h * 0.15 + bob, w * 0.7, h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Absorbed shell armor
        ctx.fillStyle = '#556060';
        ctx.fillRect(-w * 0.3, -h * 0.35 + bob, 6, 4);
        ctx.fillRect(w * 0.1, -h * 0.25 + bob, 5, 3);
        ctx.fillRect(-w * 0.1, h * 0.05 + bob, 4, 4);
        // Twelve clustered eyes
        const eyeGlow = `rgba(180, 255, 100, ${corruptGlow * phaseGlow})`;
        ctx.fillStyle = eyeGlow;
        for (let i = 0; i < 12; i++) {
          const row = Math.floor(i / 4);
          const col = i % 4;
          ctx.fillRect(-6 + col * 4, -h * 0.3 + row * 4 + bob, 2, 2);
        }
        // Tentacles — 8 reaching outward
        for (let t2 = 0; t2 < 8; t2++) {
          const tentAngle = (t2 / 8) * Math.PI * 2;
          const tentSway = Math.sin(this.state.time * 1.5 + t2 * 0.8) * 5;
          const tentLen = 20 + Math.sin(this.state.time + t2) * 5;
          const tx2 = Math.cos(tentAngle) * tentLen + tentSway;
          const ty = Math.sin(tentAngle) * tentLen * 0.6;
          ctx.fillStyle = `rgba(60, 40, 70, ${0.6 + corruptGlow * 0.2})`;
          // Draw tentacle as segments
          for (let seg = 0; seg < 4; seg++) {
            const segT = seg / 4;
            const segX = tx2 * segT;
            const segY = ty * segT + h * 0.1;
            ctx.fillRect(segX - 2, segY + bob, 4, 4);
            // Hooked barbs
            if (seg === 3) {
              ctx.fillStyle = '#ccbbaa';
              ctx.fillRect(segX, segY + bob, 2, 3);
            }
            ctx.fillStyle = `rgba(60, 40, 70, ${0.6 + corruptGlow * 0.2})`;
          }
        }
        // Phase visuals
        if (phase >= 2) {
          ctx.fillStyle = `rgba(100, 40, 80, ${0.15 + Math.sin(this.state.time * 2) * 0.05})`;
          ctx.fillRect(-w, -h + bob, w * 2, h * 2);
        }
        if (phase === 3) {
          // Ink cloud aura
          ctx.fillStyle = `rgba(20, 10, 30, ${0.2 + Math.sin(this.state.time * 4) * 0.1})`;
          ctx.fillRect(-w - 10, -h - 10 + bob, w * 2 + 20, h * 2 + 20);
        }
        break;
      }

      case 'subject_zero': {
        // SUBJECT ZERO — barely humanoid, pulsing corruption core
        const boss = this.state.boss;
        const phase = boss.creatureId === c.id ? boss.phase : 1;
        const phaseGlow = phase === 3 ? 0.9 : phase === 2 ? 0.6 : 0.4;

        // Twisted body — bent limbs
        ctx.fillStyle = '#443344';
        ctx.fillRect(-6, -8 + bob, 12, 18);
        // Exposed ribcage
        ctx.fillStyle = '#332233';
        ctx.fillRect(-5, -4 + bob, 10, 8);
        // Ribs
        ctx.fillStyle = '#665566';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(-4, -3 + i * 3 + bob, 8, 1);
        }
        // PULSING CORE — visible through ribcage
        const corePulse = 0.5 + Math.sin(this.state.time * 4) * 0.3;
        ctx.fillStyle = `rgba(255, 120, 80, ${corePulse * phaseGlow})`;
        ctx.fillRect(-2, -1 + bob, 4, 4);
        // Core glow halo
        ctx.fillStyle = `rgba(255, 120, 80, ${corePulse * phaseGlow * 0.2})`;
        ctx.fillRect(-6, -5 + bob, 12, 12);
        // Head — distorted, tilted
        ctx.fillStyle = '#554455';
        ctx.fillRect(-4, -h + bob, 8, 8);
        // Tattered lab coat remnants
        ctx.fillStyle = '#aaaaaa44';
        ctx.fillRect(-7, -6 + bob, 3, 14);
        ctx.fillRect(5, -4 + bob, 3, 12);
        // Arms — bent wrong
        ctx.fillStyle = '#443344';
        ctx.fillRect(-w + 2, -3 + bob, 5, 3);
        ctx.fillRect(-w, 0 + bob, 3, 6); // bent down
        ctx.fillRect(w - 6, -5 + bob, 5, 3);
        ctx.fillRect(w - 2, -2 + bob, 3, 8); // reaching
        // Legs — twisted
        ctx.fillStyle = '#332233';
        ctx.fillRect(-4, 10 + bob, 3, 7);
        ctx.fillRect(2, 10 + bob, 3, 8);
        // Eyes — one human, one corrupted
        ctx.fillStyle = '#88bbff';
        ctx.fillRect(-2, -h + 2 + bob, 2, 2); // human eye
        ctx.fillStyle = `rgba(255, 40, 40, ${corruptGlow * phaseGlow})`;
        ctx.fillRect(2, -h + 3 + bob, 3, 3); // corrupted eye
        // Eye glow
        ctx.fillStyle = `rgba(255, 40, 40, ${corruptGlow * phaseGlow * 0.2})`;
        ctx.fillRect(0, -h + 1 + bob, 8, 8);
        // Corruption spreading
        ctx.fillStyle = `rgba(200, 40, 40, ${corruptGlow * 0.4})`;
        ctx.fillRect(-6, -h + 6 + bob, 2, 10);
        ctx.fillRect(5, -h + 4 + bob, 2, 12);
        // Phase effects
        if (phase >= 2) {
          // Ribcage opens wider, core beam hint
          ctx.fillStyle = `rgba(255, 150, 80, ${corePulse * 0.3})`;
          ctx.fillRect(-8, -2 + bob, 16, 6);
        }
        if (phase === 3) {
          // Splitting apart visual
          ctx.fillStyle = `rgba(255, 60, 40, ${0.15 + Math.sin(this.state.time * 6) * 0.1})`;
          ctx.fillRect(-w - 5, -h - 5 + bob, w * 2 + 10, h * 2 + 10);
        }
        break;
      }
    }
  }

  renderMemoryFragments(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const mf of this.state.memoryFragments) {
      if (mf.collected) continue;
      const sx = mf.pos.x - cam.x;
      const sy = mf.pos.y - cam.y + Math.sin(this.state.time * 2 + mf.bobOffset) * 5;
      if (sx < -30 || sx > GAME_W + 30) continue;

      // Outer pulsing glow
      const pulse = 0.3 + Math.sin(this.state.time * 3) * 0.15;
      ctx.fillStyle = `rgba(180, 120, 255, ${pulse * 0.15})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 22, 0, Math.PI * 2);
      ctx.fill();

      // Mid glow
      ctx.fillStyle = `rgba(200, 150, 255, ${pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 12, 0, Math.PI * 2);
      ctx.fill();

      // Core crystal shape
      ctx.fillStyle = `rgba(220, 180, 255, ${0.8 + Math.sin(this.state.time * 4) * 0.2})`;
      ctx.fillRect(sx - 4, sy - 6, 8, 12);
      ctx.fillRect(sx - 6, sy - 4, 12, 8);

      // Inner bright core
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 2, sy - 2, 4, 4);

      // Orbiting sparkles
      for (let i = 0; i < 4; i++) {
        const angle = this.state.time * 2 + i * Math.PI / 2;
        const orbitR = 15 + Math.sin(this.state.time * 3 + i) * 3;
        const ox = sx + Math.cos(angle) * orbitR;
        const oy = sy + Math.sin(angle) * orbitR;
        ctx.fillStyle = `rgba(200, 160, 255, ${0.5 + Math.sin(this.state.time * 5 + i) * 0.3})`;
        ctx.fillRect(ox - 1, oy - 1, 2, 2);
      }

      // "MEMORY" label
      ctx.fillStyle = `rgba(200, 160, 255, ${0.6 + Math.sin(this.state.time * 2) * 0.2})`;
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MEMORY', sx, sy - 18);
    }
  }

  renderBossHPBar(ctx: CanvasRenderingContext2D) {
    const boss = this.state.boss;
    if (!boss.active || boss.defeated) return;
    const bossCreature = this.state.creatures.find(c => c.id === this.state.boss.creatureId && c.state !== 'dead');
    if (!bossCreature) return;

    const barW = 300;
    const barH = 8;
    const bx = (GAME_W - barW) / 2;
    const by = 12;
    const hpPct = bossCreature.hp / bossCreature.maxHp;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

    // HP fill with phase color
    const bossPhaseColors: Record<string, string[]> = {
      rotjaw: ['#cc4444', '#ff6622', '#ff2222'],
      tangle: ['#44aa66', '#22cc88', '#22ffaa'],
      subject_zero: ['#cc6644', '#ff8822', '#ff4422'],
    };
    const bossNameColors: Record<string, string> = {
      rotjaw: '#ff8866', tangle: '#66ffaa', subject_zero: '#ff9966',
    };
    const sprType = bossCreature.spriteType;
    const phaseColors = bossPhaseColors[sprType] || ['#cc4444', '#ff6622', '#ff2222'];
    ctx.fillStyle = phaseColors[boss.phase - 1];
    ctx.fillRect(bx, by, barW * hpPct, barH);

    // Phase markers
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(bx + barW * 0.6, by, 1, barH);
    ctx.fillRect(bx + barW * 0.3, by, 1, barH);

    // Boss name — dynamic
    ctx.fillStyle = bossNameColors[sprType] || '#ff8866';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠ ${bossCreature.name.toUpperCase()} — Phase ${boss.phase} ⚠`, GAME_W / 2, by - 3);

    // HP text
    ctx.fillStyle = '#ffccaa';
    ctx.font = '5px monospace';
    ctx.fillText(`${Math.ceil(bossCreature.hp)} / ${bossCreature.maxHp}`, GAME_W / 2, by + barH + 8);
  }

  renderPlayer(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const p = this.state.player;
    const sx = p.pos.x - cam.x;
    const sy = p.pos.y - cam.y;

    if (p.invincible > 0 && Math.sin(this.state.time * 20) > 0) return;

    ctx.save();
    ctx.translate(sx + p.width / 2, sy + p.height / 2);
    if (p.facing < 0) ctx.scale(-1, 1);

    const bob = p.swimBobble;
    const isMoving = Math.abs(p.vel.x) > 8 || Math.abs(p.vel.y) > 8;
    const legPhase = p.animFrame;

    // Legs with swim animation
    const legSwing1 = isMoving ? Math.sin(this.state.time * 8) * 3 : Math.sin(this.state.time * 1.5) * 0.5;
    const legSwing2 = isMoving ? Math.sin(this.state.time * 8 + Math.PI) * 3 : Math.sin(this.state.time * 1.5 + Math.PI) * 0.5;
    // Left leg
    ctx.fillStyle = '#2a3545';
    ctx.fillRect(-4, 8 + bob, 3, 6 + legSwing1);
    ctx.fillStyle = '#334455';
    ctx.fillRect(-4, 8 + bob, 3, 3);
    // Right leg
    ctx.fillStyle = '#2a3545';
    ctx.fillRect(1, 8 + bob, 3, 6 + legSwing2);
    ctx.fillStyle = '#334455';
    ctx.fillRect(1, 8 + bob, 3, 3);
    // Flippers
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(-5, 14 + bob + legSwing1, 4, 2);
    ctx.fillRect(0, 14 + bob + legSwing2, 4, 2);

    // Body/suit - main torso
    ctx.fillStyle = '#2a3a4a';
    ctx.fillRect(-5, -5 + bob, 10, 14);
    // Suit texture - scratches and wear
    ctx.fillStyle = '#344a5a';
    ctx.fillRect(-4, -3 + bob, 8, 2);
    ctx.fillRect(-3, 2 + bob, 6, 1);
    // Belt
    ctx.fillStyle = '#556677';
    ctx.fillRect(-5, 5 + bob, 10, 2);
    ctx.fillStyle = '#667788';
    ctx.fillRect(-2, 5 + bob, 4, 2);

    // Oxygen tank on back
    ctx.fillStyle = '#556677';
    ctx.fillRect(-7, -3 + bob, 3, 10);
    ctx.fillStyle = '#667788';
    ctx.fillRect(-7, -3 + bob, 3, 2);
    // Tank pressure indicator
    const oxyPct = p.oxygen / p.maxOxygen;
    ctx.fillStyle = oxyPct > 0.3 ? '#44aacc' : '#cc4444';
    ctx.fillRect(-6, -1 + bob, 1, Math.floor(6 * oxyPct));
    // Tube from tank to helmet
    ctx.fillStyle = '#4a5a6a';
    ctx.fillRect(-6, -5 + bob, 1, 3);
    ctx.fillRect(-5, -6 + bob, 2, 1);

    // Helmet - larger at 52px
    ctx.fillStyle = '#667788';
    ctx.fillRect(-4, -11 + bob, 8, 7);
    // Helmet rim
    ctx.fillStyle = '#778899';
    ctx.fillRect(-5, -5 + bob, 10, 1);
    ctx.fillRect(-4, -12 + bob, 8, 1);

    // Visor glass
    ctx.fillStyle = '#88ccff';
    ctx.fillRect(-2, -10 + bob, 5, 5);
    // Visor inner glow / reflection
    ctx.fillStyle = 'rgba(180, 230, 255, 0.4)';
    ctx.fillRect(-1, -9 + bob, 2, 2);
    // Visor outer glow
    ctx.fillStyle = 'rgba(136, 204, 255, 0.12)';
    ctx.fillRect(-4, -12 + bob, 10, 8);

    // Helmet light
    ctx.fillStyle = '#ffffaa';
    ctx.fillRect(3, -11 + bob, 2, 2);
    // Light glow
    ctx.fillStyle = `rgba(255, 255, 170, ${0.15 + Math.sin(this.state.time * 3) * 0.05})`;
    ctx.fillRect(2, -12 + bob, 4, 4);

    // Helmet bubbles (idle breathing)
    if (!isMoving && p.animFrame % 3 === 0) {
      ctx.fillStyle = 'rgba(150, 220, 255, 0.5)';
      ctx.fillRect(5, -10 + bob, 2, 2);
      ctx.fillRect(6, -13 + bob, 1, 1);
    }

    // Arm with harpoon
    const armBob = isMoving ? Math.sin(this.state.time * 6) * 1 : 0;
    ctx.fillStyle = '#3a4a5a';
    ctx.fillRect(4, -2 + bob + armBob, 4, 3);
    // Harpoon weapon
    ctx.fillStyle = '#8a7a6a';
    ctx.fillRect(7, -2 + bob + armBob, 6, 2);
    ctx.fillStyle = '#aabbcc';
    ctx.fillRect(12, -2 + bob + armBob, 3, 1);
    // Harpoon tip
    ctx.fillStyle = '#ccddee';
    ctx.fillRect(14, -3 + bob + armBob, 2, 3);

    // Wrist pressure gauge
    ctx.fillStyle = '#334455';
    ctx.fillRect(4, 0 + bob + armBob, 3, 2);
    ctx.fillStyle = oxyPct > 0.3 ? '#44cc88' : '#cc4444';
    ctx.fillRect(5, 0 + bob + armBob, Math.ceil(oxyPct * 2), 1);

    ctx.restore();

    // Swim bubbles trail — enhanced
    if (isMoving) {
      if (Math.random() < 0.35) {
        this.state.particles.push({
          pos: { x: p.pos.x - p.facing * 6, y: p.pos.y + 3 },
          vel: { x: -p.facing * 8, y: -6 },
          lifetime: 0.9, maxLifetime: 0.9, size: 1 + Math.random() * 1.5,
          color: 'rgba(150, 220, 255, 0.4)', type: 'bubble',
        });
      }
      // Speed lines when sprinting
      if (Math.abs(p.vel.x) > 50 || Math.abs(p.vel.y) > 50) {
        this.state.particles.push({
          pos: { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 + (Math.random() - 0.5) * 10 },
          vel: { x: -p.vel.x * 0.3, y: -p.vel.y * 0.3 },
          lifetime: 0.15, maxLifetime: 0.15, size: 1,
          color: 'rgba(150, 200, 255, 0.2)', type: 'glow',
        });
      }
    }

    // Constant helmet breathing bubbles (always)
    if (Math.random() < 0.1) {
      const bubSize = oxyPct < 0.2 ? 2 + Math.random() * 2 : 1 + Math.random();
      const bubVelY = oxyPct < 0.2 ? -15 - Math.random() * 10 : -6 - Math.random() * 4;
      this.state.particles.push({
        pos: { x: p.pos.x + p.width / 2 + p.facing * 4, y: p.pos.y - 4 },
        vel: { x: p.facing * 2 + (Math.random() - 0.5) * 4, y: bubVelY },
        lifetime: 1.2, maxLifetime: 1.2, size: bubSize,
        color: oxyPct < 0.2 ? 'rgba(200, 200, 255, 0.6)' : 'rgba(150, 220, 255, 0.35)', type: 'bubble',
      });
    }
  }

  renderHelmetLight(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const p = this.state.player;
    const zone = this.state.depthZone;
    if (zone < 1) return;

    const sx = p.pos.x - cam.x + p.width / 2;
    const sy = p.pos.y - cam.y + p.height / 2 - 8;
    const dir = p.facing;
    const intensity = Math.min(1, zone * 0.3);
    const flicker = 0.9 + Math.sin(this.state.time * 7) * 0.07 + Math.sin(this.state.time * 13) * 0.03;

    // Light cone
    ctx.save();
    ctx.globalAlpha = intensity * flicker * 0.15;
    ctx.fillStyle = '#ffffcc';
    ctx.beginPath();
    ctx.moveTo(sx + dir * 5, sy);
    ctx.lineTo(sx + dir * 100, sy - 30);
    ctx.lineTo(sx + dir * 100, sy + 25);
    ctx.closePath();
    ctx.fill();

    // Inner brighter cone
    ctx.globalAlpha = intensity * flicker * 0.08;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(sx + dir * 5, sy);
    ctx.lineTo(sx + dir * 60, sy - 15);
    ctx.lineTo(sx + dir * 60, sy + 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Dust motes floating in the light cone
    if (zone >= 2 && Math.random() < 0.15) {
      const moteD = 20 + Math.random() * 70;
      const moteSpread = (Math.random() - 0.5) * 20;
      this.state.particles.push({
        pos: { x: p.pos.x + p.width / 2 + dir * moteD, y: p.pos.y - 6 + moteSpread },
        vel: { x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 2 },
        lifetime: 1.5, maxLifetime: 1.5, size: 0.5 + Math.random() * 0.5,
        color: `rgba(255, 255, 200, ${0.15 + Math.random() * 0.1})`, type: 'glow',
      });
    }
  }

  renderProjectiles(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const proj of this.state.projectiles) {
      const sx = proj.pos.x - cam.x;
      const sy = proj.pos.y - cam.y;

      if (proj.fromPlayer) {
        const isCrit = proj.type === 'harpoon_crit';
        const color = isCrit ? '#ffdd44' : '#aaddff';
        // Harpoon bolt
        ctx.fillStyle = color;
        ctx.fillRect(sx - 2, sy - 1, 5, 3);
        // Trail glow
        ctx.fillStyle = (isCrit ? '#ffdd44' : 'rgba(150, 220, 255, 0.3)');
        ctx.globalAlpha = 0.4;
        ctx.fillRect(sx - 6, sy - 2, 8, 5);
        ctx.globalAlpha = 1;
        // Tip
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx + 3, sy, 2, 1);
      } else {
        let color = '#44ff44';
        let glowColor = '#44ff4444';
        if (proj.type === 'acid') { color = '#66ff44'; glowColor = '#66ff4433'; }
        else if (proj.type === 'shock') { color = '#8888ff'; glowColor = '#8888ff33'; }

        ctx.fillStyle = color;
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
        // Inner core
        ctx.fillStyle = '#ffffff55';
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
        // Glow
        ctx.fillStyle = glowColor;
        ctx.fillRect(sx - 5, sy - 5, 10, 10);
      }
    }
  }

  renderParticles(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const p of this.state.particles) {
      const sx = p.pos.x - cam.x;
      const sy = p.pos.y - cam.y;
      const alpha = p.lifetime / p.maxLifetime;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.type === 'glow') {
        // Soft glow particle
        ctx.fillRect(sx - p.size, sy - p.size, p.size * 2, p.size * 2);
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillRect(sx - p.size * 2, sy - p.size * 2, p.size * 4, p.size * 4);
      } else if (p.type === 'corruption') {
        ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
        ctx.globalAlpha = alpha * 0.2;
        ctx.fillRect(sx - p.size, sy - p.size, p.size * 2, p.size * 2);
      } else if (p.type === 'memory') {
        // Sparkling memory particles
        ctx.fillStyle = p.color;
        ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillRect(sx - p.size, sy - p.size, p.size * 2, p.size * 2);
      } else if (p.type === 'boss_charge') {
        ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillRect(sx - p.size * 1.5, sy - p.size * 1.5, p.size * 3, p.size * 3);
      } else if (p.type === 'pickup_text') {
        ctx.font = 'bold 11px "Press Start 2P", monospace';
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fillText('+30% O₂', sx, sy);
        ctx.shadowBlur = 0;
      } else if (p.type === 'damage_text') {
        const scale = 1 + (1 - alpha) * 0.3;
        ctx.font = `bold ${Math.floor(p.size * scale)}px "Press Start 2P", monospace`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(p.text || '', sx, sy);
        ctx.shadowBlur = 0;
      } else if (p.type === 'poison') {
        ctx.fillStyle = p.color;
        ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillRect(sx - p.size, sy - p.size, p.size * 2, p.size * 2);
      } else if (p.type === 'shockwave') {
        // Expanding ring shockwave
        const expandT = 1 - alpha;
        const radius = p.size + expandT * 120;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 - expandT * 2;
        ctx.globalAlpha = alpha * 0.6;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.stroke();
        // Inner fainter ring
        ctx.globalAlpha = alpha * 0.2;
        ctx.beginPath();
        ctx.arc(sx, sy, radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'spark') {
        // Electric spark — small bright flash with random jitter
        ctx.fillStyle = p.color;
        const jx = (Math.random() - 0.5) * 2;
        const jy = (Math.random() - 0.5) * 2;
        ctx.fillRect(sx + jx - 1, sy + jy - 1, 2, 2);
        // Spark trail
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillRect(sx - p.vel.x * 0.01 - 1, sy - p.vel.y * 0.01 - 1, 2, 2);
      } else if (p.type === 'death_chunk') {
        // Rotating pixel chunk
        ctx.save();
        ctx.translate(sx, sy);
        const rot = (p.rotation || 0) + (p.rotationSpeed || 0) * (p.maxLifetime - p.lifetime);
        ctx.rotate(rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        // Detail pixel
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-p.size / 4, -p.size / 4, p.size / 2, p.size / 2);
        ctx.restore();
      } else if (p.type === 'wake') {
        // Wake trail — fading horizontal streaks
        ctx.fillStyle = p.color;
        ctx.fillRect(sx - p.size * 2, sy - 0.5, p.size * 4, 1);
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillRect(sx - p.size * 3, sy - 1, p.size * 6, 2);
      } else if (p.type === 'ripple') {
        // Concentric ripple ring
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  renderLightRays(ctx: CanvasRenderingContext2D, cam: Vec2) {
    if (cam.y > 350) return;
    const alpha = Math.max(0, 0.1 - cam.y * 0.0002);
    ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
    for (let i = 0; i < 7; i++) {
      const x = (i * 140 + this.state.time * 6) % (GAME_W + 60) - 30;
      const w = 10 + Math.sin(this.state.time * 0.4 + i) * 5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 20, GAME_H);
      ctx.lineTo(x - 20 + w, GAME_H);
      ctx.lineTo(x + w, 0);
      ctx.closePath();
      ctx.fill();
    }

    // Caustic light pattern for shallows
    if (cam.y < 150) {
      ctx.globalAlpha = 0.04;
      ctx.fillStyle = '#bbddff';
      for (let i = 0; i < 15; i++) {
        const cx = (i * 70 + Math.sin(this.state.time * 0.8 + i * 1.5) * 20) % GAME_W;
        const cy = Math.sin(this.state.time * 0.5 + i * 2) * 15 + 30;
        ctx.fillRect(cx, cy, 12 + Math.sin(this.state.time + i) * 4, 3);
      }
      ctx.globalAlpha = 1;
    }
  }

  renderWaterDistortion(ctx: CanvasRenderingContext2D) {
    const zone = this.state.depthZone;
    const distortionStrength = 1 + zone * 0.5; // stronger in deeper zones

    // ===== PIXEL-OFFSET DISTORTION =====
    // Copy current frame to offscreen canvas
    if (this.distortionCanvas && this.distortionCtx) {
      this.distortionCtx.drawImage(this.canvas, 0, 0);

      // Apply pixel-row offset distortion
      const t = this.state.time;
      for (let y = 0; y < GAME_H; y += 2) {
        // Sine-based horizontal pixel offset — varies by depth and time
        const offset = Math.round(
          Math.sin(t * 0.6 + y * 0.04) * distortionStrength +
          Math.sin(t * 1.2 + y * 0.08) * distortionStrength * 0.5 +
          Math.sin(t * 0.3 + y * 0.02) * distortionStrength * 0.3
        );

        if (offset !== 0) {
          ctx.drawImage(
            this.distortionCanvas,
            0, y, GAME_W, 2,     // source
            offset, y, GAME_W, 2  // dest (shifted)
          );
        }
      }
    }

    // ===== WAVE LINES =====
    ctx.globalAlpha = 0.03 + zone * 0.005;
    ctx.strokeStyle = zone >= 4 ? '#ff886644' : '#aaddff';
    ctx.lineWidth = 1;
    for (let y = 0; y < GAME_H; y += 30) {
      const wave = Math.sin(this.state.time * 0.8 + y * 0.05) * (2 + zone);
      ctx.beginPath();
      ctx.moveTo(0, y + wave);
      for (let x = 0; x < GAME_W; x += 15) {
        const wy = y + Math.sin(this.state.time * 0.6 + x * 0.02 + y * 0.03) * (1.5 + zone * 0.5);
        ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    // ===== CURRENT STREAKS ===== (visible diagonal pixel streaks showing water flow)
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = zone >= 3 ? '#4444aa' : '#88ccff';
    ctx.lineWidth = 1;
    const currentDir = Math.sin(this.state.time * 0.2) > 0 ? 1 : -1;
    for (let i = 0; i < 8; i++) {
      const sx = ((i * 120 + this.state.time * 15 * currentDir) % (GAME_W + 100)) - 50;
      const sy = 50 + i * 50 + Math.sin(this.state.time * 0.5 + i) * 20;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + currentDir * 40, sy + 8);
      ctx.stroke();
    }

    // ===== RIPPLES ===== (from impacts and movement)
    this.renderRipples(ctx);

    ctx.globalAlpha = 1;
  }

  spawnRipple(worldX: number, worldY: number, maxRadius: number, strength = 1) {
    this.ripples.push({
      x: worldX, y: worldY,
      radius: 2, maxRadius,
      strength, time: 0,
    });
    // Limit active ripples
    if (this.ripples.length > 15) this.ripples.shift();
  }

  updateRipples(dt: number) {
    this.ripples = this.ripples.filter(r => {
      r.time += dt;
      r.radius += dt * 60; // expand speed
      return r.radius < r.maxRadius;
    });
  }

  renderWaterCurrents(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const t = this.state.time;

    for (const current of this.state.waterCurrents) {
      const startX = current.pos.x - cam.x;
      const startY = current.pos.y - cam.y;
      const endX = startX + current.dir.x * current.length;
      const endY = startY + current.dir.y * current.length;

      // Skip if off-screen
      const minX = Math.min(startX, endX) - current.width;
      const maxX = Math.max(startX, endX) + current.width;
      if (maxX < -20 || minX > GAME_W + 20) continue;

      ctx.save();

      // Draw flowing streaks along the current
      const numStreaks = Math.floor(current.length / 20);
      const perpX = -current.dir.y;
      const perpY = current.dir.x;

      for (let i = 0; i < numStreaks; i++) {
        // Stagger streaks across the width and along the length
        const lateralOffset = (((i * 7 + 3) % 5) / 4 - 0.5) * current.width * 0.8;
        const phase = ((t * 1.5 + i * 0.4) % 1); // 0-1 cycling position along current
        const along = phase * current.length;

        const sx = startX + current.dir.x * along + perpX * lateralOffset;
        const sy = startY + current.dir.y * along + perpY * lateralOffset;

        // Streak line
        const streakLen = 12 + Math.sin(i * 2.3) * 4;
        const ex = sx + current.dir.x * streakLen;
        const ey = sy + current.dir.y * streakLen;

        // Fade at edges of the current
        const edgeFade = 1 - Math.abs(lateralOffset) / (current.width * 0.5);
        // Fade at start/end
        const endFade = Math.min(1, along / 30, (current.length - along) / 30);
        const alpha = 0.25 * edgeFade * endFade;

        ctx.strokeStyle = `rgba(120, 200, 255, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Arrow head at end of streak
        if (i % 2 === 0) {
          const arrowSize = 3;
          const ax1 = ex - current.dir.x * arrowSize + perpX * arrowSize * 0.6;
          const ay1 = ey - current.dir.y * arrowSize + perpY * arrowSize * 0.6;
          const ax2 = ex - current.dir.x * arrowSize - perpX * arrowSize * 0.6;
          const ay2 = ey - current.dir.y * arrowSize - perpY * arrowSize * 0.6;

          ctx.fillStyle = `rgba(120, 200, 255, ${alpha * 0.8})`;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ax1, ay1);
          ctx.lineTo(ax2, ay2);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Ambient glow along current center line
      ctx.globalAlpha = 0.04 + Math.sin(t * 2) * 0.015;
      ctx.strokeStyle = 'rgba(100, 180, 255, 1)';
      ctx.lineWidth = current.width * 0.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.restore();
    }

    // Spawn current particles periodically
    if (Math.random() < 0.3) {
      for (const current of this.state.waterCurrents) {
        if (Math.random() > 0.4) continue;
        const along = Math.random() * current.length;
        const perpOff = (Math.random() - 0.5) * current.width * 0.7;
        const perpX = -current.dir.y;
        const perpY = current.dir.x;
        const px = current.pos.x + current.dir.x * along + perpX * perpOff;
        const py = current.pos.y + current.dir.y * along + perpY * perpOff;
        this.state.particles.push({
          pos: { x: px, y: py },
          vel: { x: current.dir.x * current.strength * 0.5, y: current.dir.y * current.strength * 0.5 },
          lifetime: 0.8, maxLifetime: 0.8, size: 1 + Math.random(),
          color: `rgba(120, 200, 255, ${0.15 + Math.random() * 0.1})`,
          type: 'current',
        });
      }
    }
  }

  renderRipples(ctx: CanvasRenderingContext2D) {
    const cam = this.state.camera;
    for (const r of this.ripples) {
      const sx = r.x - cam.x;
      const sy = r.y - cam.y;
      if (sx < -r.maxRadius || sx > GAME_W + r.maxRadius) continue;

      const progress = r.radius / r.maxRadius;
      const alpha = (1 - progress) * 0.25 * r.strength;

      // Outer ring
      ctx.strokeStyle = `rgba(150, 220, 255, ${alpha})`;
      ctx.lineWidth = 2 - progress;
      ctx.beginPath();
      // Pixel-art ring: draw as a series of small rects around a circle
      const steps = Math.floor(r.radius * 2);
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const rx = sx + Math.round(Math.cos(angle) * r.radius);
        const ry = sy + Math.round(Math.sin(angle) * r.radius);
        ctx.fillStyle = `rgba(150, 220, 255, ${alpha})`;
        ctx.fillRect(rx, ry, 2, 2);
      }

      // Inner fainter ring
      if (r.radius > 8) {
        const innerR = r.radius * 0.6;
        const innerAlpha = alpha * 0.4;
        const innerSteps = Math.floor(innerR * 1.5);
        for (let i = 0; i < innerSteps; i++) {
          const angle = (i / innerSteps) * Math.PI * 2;
          const rx = sx + Math.round(Math.cos(angle) * innerR);
          const ry = sy + Math.round(Math.sin(angle) * innerR);
          ctx.fillStyle = `rgba(200, 240, 255, ${innerAlpha})`;
          ctx.fillRect(rx, ry, 1, 1);
        }
      }
    }
  }

  renderVignette(ctx: CanvasRenderingContext2D) {
    const zone = this.state.depthZone;
    const intensity = 0.5 + zone * 0.1;
    const grad = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.35, GAME_W / 2, GAME_H / 2, GAME_H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${intensity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
  }

  renderZoneOverlay(ctx: CanvasRenderingContext2D) {
    const zone = this.state.depthZone;
    // Zone 1: green murky tint
    if (zone === 1) {
      ctx.fillStyle = 'rgba(20, 50, 20, 0.06)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }
    // Zone 2: slight flicker
    if (zone === 2 && Math.sin(this.state.time * 8) > 0.95) {
      ctx.fillStyle = 'rgba(100, 255, 100, 0.02)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }
    // Zone 3: darkness overlay
    if (zone === 3) {
      ctx.fillStyle = 'rgba(0, 0, 10, 0.15)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }
    // Zone 4: corruption pulse
    if (zone >= 4) {
      const pulse = Math.sin(this.state.time * 1.5) * 0.03 + 0.05;
      ctx.fillStyle = `rgba(80, 10, 10, ${pulse})`;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }
  }

  renderCorruptionTendrils(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const zone = this.state.depthZone;
    if (zone < 3) return;
    const p = this.state.player;
    const px = p.pos.x - cam.x + p.width / 2;
    const py = p.pos.y - cam.y + p.height / 2;

    // Corruption on terrain surface reaching toward player
    const startX = Math.floor(cam.x);
    const endX = Math.min(startX + GAME_W + 1, this.state.terrain.length);
    const intensity = zone >= 4 ? 0.35 : 0.15;

    for (let x = startX; x < endX; x += 6) {
      const ty = this.state.terrain[x] - cam.y;
      const sx = x - cam.x;
      const distToPlayer = Math.sqrt((sx - px) ** 2 + (ty - py) ** 2);
      
      if (distToPlayer < 120) {
        // Tendrils reach toward player
        const reach = Math.max(0, (120 - distToPlayer) / 120) * 12;
        const dirY = py < ty ? -1 : 0.3;
        const wave = Math.sin(this.state.time * 2 + x * 0.1) * 2;
        
        const corruptR = zone >= 4 ? 180 : 100;
        const corruptG = zone >= 4 ? 30 : 20;
        ctx.fillStyle = `rgba(${corruptR}, ${corruptG}, ${corruptG}, ${intensity + Math.sin(this.state.time * 3 + x) * 0.05})`;
        for (let i = 0; i < reach; i += 2) {
          ctx.fillRect(sx + wave * (i / reach), ty + dirY * i, 2, 2);
        }
      }
      
      // Static corruption veins on surface
      if ((x * 7 + 13) % 19 < 5) {
        const veinLen = 4 + Math.sin(x * 0.3) * 3;
        const pulse = Math.sin(this.state.time * 1.5 + x * 0.05) * 0.1;
        ctx.fillStyle = `rgba(${zone >= 4 ? 200 : 120}, 20, 30, ${0.2 + pulse})`;
        ctx.fillRect(sx, ty - veinLen, 1, veinLen);
      }
    }
  }

  renderDarknessOverlay(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const zone = this.state.depthZone;
    if (zone < 2) return;

    // Progressive darkness based on zone
    const darkness = zone === 2 ? 0.08 : zone === 3 ? 0.25 : zone >= 4 ? 0.4 : 0;
    
    // Create a darkness layer with cutout for helmet light
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 8, ${darkness})`;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Cut out area around player with helmet light
    const p = this.state.player;
    const px = p.pos.x - cam.x + p.width / 2;
    const py = p.pos.y - cam.y + p.height / 2 - 6;
    const lightRadius = zone >= 4 ? 60 : zone === 3 ? 80 : 120;
    const flicker = 0.95 + Math.sin(this.state.time * 7 + Math.random() * 0.5) * 0.05;
    
    // Subtract light from darkness with radial gradient
    ctx.globalCompositeOperation = 'destination-out';
    const lightGrad = ctx.createRadialGradient(px, py, 0, px, py, lightRadius * flicker);
    lightGrad.addColorStop(0, `rgba(0,0,0,${0.6 * darkness})`);
    lightGrad.addColorStop(0.5, `rgba(0,0,0,${0.3 * darkness})`);
    lightGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // Bioluminescent creature glow — illuminate around creatures
    for (const c of this.state.creatures) {
      if (c.state === 'dead') continue;
      const cx = c.pos.x - cam.x + c.width / 2;
      const cy = c.pos.y - cam.y + c.height / 2;
      if (cx < -50 || cx > GAME_W + 50) continue;

      const glowColor = c.spriteType === 'jelly' ? '120, 100, 255' :
        c.spriteType === 'eel' ? '100, 255, 100' :
        c.spriteType === 'shark' || c.spriteType === 'rotjaw' ? '255, 40, 40' :
        '255, 180, 50';
      const glowRadius = c.spriteType === 'rotjaw' ? 50 : 25;
      const glowPulse = 0.08 + Math.sin(c.corruptionPulse) * 0.03;
      
      const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
      cGrad.addColorStop(0, `rgba(${glowColor}, ${glowPulse})`);
      cGrad.addColorStop(1, `rgba(${glowColor}, 0)`);
      ctx.fillStyle = cGrad;
      ctx.fillRect(cx - glowRadius, cy - glowRadius, glowRadius * 2, glowRadius * 2);
    }
  }

  renderDamageVignette(ctx: CanvasRenderingContext2D) {
    // Red flash on damage
    if (this.damageFlash > 0) {
      const alpha = this.damageFlash * 1.5;
      ctx.fillStyle = `rgba(180, 20, 20, ${Math.min(0.3, alpha)})`;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }

    // Critical HP red pulse
    const p = this.state.player;
    const hpPct = p.hp / p.maxHp;
    if (hpPct < 0.25 && hpPct > 0) {
      const pulse = Math.sin(this.state.time * 4) * 0.08 + 0.1;
      const grad = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.3, GAME_W / 2, GAME_H / 2, GAME_H * 0.7);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(120, 10, 10, ${pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }
  }

  renderHelmetCracks(ctx: CanvasRenderingContext2D) {
    if (this.helmetCracks <= 0) return;
    ctx.strokeStyle = `rgba(200, 200, 220, ${0.15 + this.helmetCracks * 0.06})`;
    ctx.lineWidth = 1;

    // Predefined crack patterns
    const cracks = [
      [[50, 0], [70, 30], [65, 60]],
      [[GAME_W - 30, 0], [GAME_W - 50, 40], [GAME_W - 45, 80]],
      [[0, GAME_H * 0.3], [30, GAME_H * 0.35], [50, GAME_H * 0.5]],
      [[GAME_W, GAME_H * 0.6], [GAME_W - 40, GAME_H * 0.55], [GAME_W - 60, GAME_H * 0.7]],
      [[GAME_W * 0.3, 0], [GAME_W * 0.35, 25], [GAME_W * 0.28, 50], [GAME_W * 0.32, 80]],
    ];

    for (let i = 0; i < Math.min(this.helmetCracks, cracks.length); i++) {
      ctx.beginPath();
      ctx.moveTo(cracks[i][0][0], cracks[i][0][1]);
      for (let j = 1; j < cracks[i].length; j++) {
        ctx.lineTo(cracks[i][j][0], cracks[i][j][1]);
      }
      ctx.stroke();
      // Small branches off main crack
      if (cracks[i].length > 1) {
        const mid = cracks[i][1];
        ctx.beginPath();
        ctx.moveTo(mid[0], mid[1]);
        ctx.lineTo(mid[0] + 10, mid[1] + 15);
        ctx.stroke();
      }
    }
  }

  renderPressureEffect(ctx: CanvasRenderingContext2D) {
    const zone = this.state.depthZone;
    if (zone < 3) return;

    // Viewport compression pulse in deep zones
    const pulseStr = zone >= 4 ? 0.015 : 0.008;
    const pulse = Math.sin(this.state.time * 0.8) * pulseStr;
    
    // Dark bars pulsing at edges to simulate pressure
    const barW = Math.max(0, pulse * GAME_W);
    const barH = Math.max(0, pulse * GAME_H);
    if (barW > 0 || barH > 0) {
      ctx.fillStyle = `rgba(0, 0, 5, ${0.3 + pulse * 10})`;
      ctx.fillRect(0, 0, barW, GAME_H); // left
      ctx.fillRect(GAME_W - barW, 0, barW, GAME_H); // right
      ctx.fillRect(0, 0, GAME_W, barH); // top
      ctx.fillRect(0, GAME_H - barH, GAME_W, barH); // bottom
    }

    // Pressure bubbles on player suit in zone 4+
    if (zone >= 4 && Math.random() < 0.02) {
      const p = this.state.player;
      this.state.particles.push({
        pos: { x: p.pos.x + (Math.random() - 0.5) * p.width, y: p.pos.y + (Math.random() - 0.5) * p.height },
        vel: { x: (Math.random() - 0.5) * 8, y: -5 - Math.random() * 5 },
        lifetime: 0.4, maxLifetime: 0.4, size: 1,
        color: 'rgba(150, 200, 255, 0.5)', type: 'bubble',
      });
    }
  }

  renderDeathOverlay(ctx: CanvasRenderingContext2D) {
    const t = this.deathSequence;
    
    // Slow fade to black from edges
    if (t > 0.5) {
      const fadeAlpha = Math.min(0.9, (t - 0.5) * 0.2);
      const grad = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * Math.max(0.05, 0.4 - t * 0.05), GAME_W / 2, GAME_H / 2, GAME_H * 0.6);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${fadeAlpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }

    // Death text
    if (t > 2.5) {
      const textAlpha = Math.min(1, (t - 2.5) * 0.5);
      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = '#667788';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      const depth = Math.floor(this.state.player.pos.y * 0.3);
      ctx.fillText(`Depth: ${depth}m`, GAME_W / 2, GAME_H / 2 - 10);
      ctx.fillStyle = '#445566';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText('The ocean remembers nothing', GAME_W / 2, GAME_H / 2 + 10);
      ctx.globalAlpha = 1;
    }
  }

  renderCreatureDeathAnims(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const c of this.state.creatures) {
      if (c.state !== 'dead') continue;
      const sx = c.pos.x - cam.x;
      const sy = c.pos.y - cam.y;
      if (sx < -60 || sx > GAME_W + 60) continue;

      const deathProgress = 1 - Math.max(0, c.deathTimer / (c.spriteType === 'rotjaw' ? 5 : c.spriteType === 'tangle' ? 5 : c.spriteType === 'subject_zero' ? 5 : c.spriteType === 'shark' ? 3 : c.spriteType === 'crab' ? 2.5 : c.spriteType === 'eel' ? 2 : 1.5));

      ctx.save();

      switch (c.spriteType) {
        case 'shark':
        case 'rotjaw': {
          // Barrel roll descent — rotating and sinking
          const rollAngle = deathProgress * Math.PI * 4; // 2 full rotations
          ctx.translate(sx + c.width / 2, sy + c.height / 2);
          ctx.rotate(rollAngle);
          ctx.globalAlpha = 1 - deathProgress;
          if (c.facing < 0) ctx.scale(-1, 1);
          this.drawCreatureSprite(ctx, c);
          break;
        }
        case 'tangle': {
          // Tentacles fly apart, body implodes then explodes with ink
          ctx.translate(sx + c.width / 2, sy + c.height / 2);
          const implode = deathProgress < 0.4 ? 1 - deathProgress * 0.5 : 0.8 + (deathProgress - 0.4) * 0.5;
          ctx.scale(implode, implode);
          ctx.globalAlpha = Math.max(0, 1 - deathProgress * 1.2);
          ctx.rotate(deathProgress * 0.5);
          this.drawCreatureSprite(ctx, c);
          // Ink eruption overlay
          if (deathProgress > 0.3) {
            const inkAlpha = Math.min(0.6, (deathProgress - 0.3) * 1.5);
            ctx.fillStyle = `rgba(20, 10, 30, ${inkAlpha})`;
            ctx.fillRect(-c.width, -c.height, c.width * 2, c.height * 2);
          }
          break;
        }
        case 'subject_zero': {
          // Glitch dissolve — flickers between visible and invisible
          ctx.translate(sx + c.width / 2, sy + c.height / 2);
          const glitchVisible = Math.sin(deathProgress * 80) > -0.3;
          ctx.globalAlpha = glitchVisible ? Math.max(0, 1 - deathProgress) : 0;
          const glitchOffset = Math.sin(deathProgress * 50) * 5 * deathProgress;
          ctx.translate(glitchOffset, 0);
          this.drawCreatureSprite(ctx, c);
          break;
        }
        case 'jelly': {
          // Flash and dissolve — shrink + flash white
          const shrink = 1 - deathProgress * 0.8;
          const flash = Math.sin(deathProgress * 30) > 0 ? 0.5 : 0;
          ctx.translate(sx + c.width / 2, sy + c.height / 2);
          ctx.scale(shrink, shrink);
          ctx.globalAlpha = (1 - deathProgress) * 0.8;
          if (c.facing < 0) ctx.scale(-1, 1);
          this.drawCreatureSprite(ctx, c);
          // White flash overlay
          if (flash > 0 && deathProgress < 0.5) {
            ctx.fillStyle = `rgba(200, 200, 255, ${flash})`;
            ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
          }
          break;
        }
        case 'eel': {
          // Segmented dissolve — breaks apart
          ctx.translate(sx + c.width / 2, sy + c.height / 2);
          ctx.globalAlpha = 1 - deathProgress;
          // Scatter segments apart
          const scatter = deathProgress * 15;
          for (let seg = 0; seg < 3; seg++) {
            ctx.save();
            ctx.translate(
              (seg - 1) * scatter * (seg % 2 === 0 ? 1 : -1),
              (seg - 1) * scatter * 0.5
            );
            ctx.globalAlpha = Math.max(0, 1 - deathProgress - seg * 0.2);
            ctx.fillStyle = `rgb(${50 + seg * 15}, ${90 + seg * 20}, ${50 + seg * 15})`;
            const segW = c.width / 3;
            ctx.fillRect(-segW / 2, -c.height / 4, segW, c.height / 2);
            ctx.restore();
          }
          break;
        }
        case 'crab': {
          // Shell cracks open, collapses flat
          ctx.translate(sx + c.width / 2, sy + c.height / 2);
          ctx.globalAlpha = 1 - deathProgress * 0.7;
          // Flatten vertically
          ctx.scale(1 + deathProgress * 0.3, 1 - deathProgress * 0.6);
          if (c.facing < 0) ctx.scale(-1, 1);
          this.drawCreatureSprite(ctx, c);
          // Crack lines
          if (deathProgress > 0.2) {
            ctx.strokeStyle = `rgba(255, 180, 50, ${deathProgress})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-c.width / 4, -c.height / 2);
            ctx.lineTo(c.width / 4, c.height / 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(c.width / 4, -c.height / 2);
            ctx.lineTo(-c.width / 4, c.height / 2);
            ctx.stroke();
          }
          break;
        }
        default: {
          // Fish: pop apart — quick dissolve
          ctx.translate(sx + c.width / 2, sy + c.height / 2);
          const popScale = deathProgress < 0.1 ? 1 + deathProgress * 3 : Math.max(0, 1 - (deathProgress - 0.1) * 1.2);
          ctx.scale(popScale, popScale);
          ctx.globalAlpha = Math.max(0, 1 - deathProgress * 1.5);
          if (c.facing < 0) ctx.scale(-1, 1);
          this.drawCreatureSprite(ctx, c);
          break;
        }
      }

      ctx.restore();
    }
  }

  renderBossIntro(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const t = 3.0 - this.bossIntroTimer; // time since intro started
    const boss = this.state.creatures.find(c => c.id === this.state.boss.creatureId);
    if (!boss) return;

    // Screen dim — spotlight effect
    const dimAlpha = t < 0.5 ? t * 0.8 : t > 2.5 ? Math.max(0, (3.0 - t) * 0.8) : 0.4;
    ctx.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Spotlight on boss
    if (t > 0.3 && t < 2.7) {
      const bx = boss.pos.x - cam.x + boss.width / 2;
      const by = boss.pos.y - cam.y + boss.height / 2;
      const spotRadius = 60 + Math.sin(t * 3) * 5;

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const spotGrad = ctx.createRadialGradient(bx, by, 0, bx, by, spotRadius);
      spotGrad.addColorStop(0, `rgba(0,0,0,${dimAlpha * 0.9})`);
      spotGrad.addColorStop(0.7, `rgba(0,0,0,${dimAlpha * 0.5})`);
      spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    // Gate bars sliding in from sides
    if (t < 1.0) {
      const gateProgress = Math.min(1, t * 2);
      ctx.fillStyle = '#1a2030';
      // Left gate
      ctx.fillRect(0, 0, 20 * gateProgress, GAME_H);
      // Right gate  
      ctx.fillRect(GAME_W - 20 * gateProgress, 0, 20 * gateProgress, GAME_H);
      // Gate slam flash
      if (t > 0.4 && t < 0.6) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * (1 - (t - 0.4) * 5)})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
    }

    // Boss name reveal
    if (t > 1.0 && t < 2.8) {
      const nameAlpha = t < 1.5 ? (t - 1.0) * 2 : t > 2.3 ? Math.max(0, (2.8 - t) * 2) : 1;
      ctx.globalAlpha = nameAlpha;

      // Boss name
      const bossColors: Record<string, string> = { rotjaw: '#ff4422', tangle: '#44ff88', subject_zero: '#ff8844' };
      const bossSubtitles: Record<string, string> = { rotjaw: 'Guardian of the Shallows', tangle: 'Terror of the Kelp', subject_zero: 'The First Experiment' };
      const sprType = boss?.spriteType || 'rotjaw';
      ctx.fillStyle = bossColors[sprType] || '#ff4422';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = bossColors[sprType] || '#ff0000';
      ctx.shadowBlur = 8;
      ctx.fillText(`⚠ ${(boss?.name || 'BOSS').toUpperCase()} ⚠`, GAME_W / 2, GAME_H / 2 - 30);

      // Subtitle
      ctx.fillStyle = '#aa6644';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.shadowBlur = 4;
      ctx.fillText(bossSubtitles[sprType] || 'Boss', GAME_W / 2, GAME_H / 2 - 15);

      // HP bar slides in
      if (t > 1.3) {
        const barSlide = Math.min(1, (t - 1.3) * 3);
        const barW = 300 * barSlide;
        const bx2 = (GAME_W - barW) / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(bx2 - 2, GAME_H / 2, barW + 4, 8);
        ctx.fillStyle = '#cc4444';
        ctx.fillRect(bx2, GAME_H / 2 + 1, barW, 6);
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  renderZoneTransition(ctx: CanvasRenderingContext2D) {
    const t = this.zoneTransitionTimer;
    const totalDuration = 3.5;
    const zone = this.state.depthZone;
    const zoneColors = ['#66ccff', '#44ff88', '#ffcc44', '#6644ff', '#ff2244'];
    const color = zoneColors[Math.min(zone, 4)];

    const hashFn = (bx: number, by: number) => {
      const v = Math.sin(bx * 127.1 + by * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };

    // Phase 1 (3.5 → 2.5): Pixel dissolve wipe IN from edges
    if (t > 2.5) {
      const progress = (totalDuration - t) / 1.0;
      const blockSize = 10;
      for (let bx = 0; bx < GAME_W; bx += blockSize) {
        for (let by = 0; by < GAME_H; by += blockSize) {
          const h = hashFn(bx, by);
          const edgeDist = Math.min(bx / GAME_W, 1 - bx / GAME_W, by / GAME_H, 1 - by / GAME_H) * 2;
          if (h < progress * 1.5 - edgeDist * 0.5) {
            const alpha = Math.min(1, (progress * 1.5 - edgeDist * 0.5 - h) * 3);
            ctx.fillStyle = `rgba(0, 0, 5, ${0.9 * alpha})`;
            ctx.fillRect(bx, by, blockSize, blockSize);
          }
        }
      }
    }

    // Phase 2 (2.5 → 1.0): Title card with glow and flavor text
    if (t <= 2.5 && t > 1.0) {
      const cardAlpha = t > 2.0 ? (2.5 - t) * 2 : t < 1.5 ? (t - 1.0) * 2 : 1;
      ctx.fillStyle = `rgba(0, 0, 5, ${0.85 * cardAlpha})`;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.save();
      ctx.globalAlpha = cardAlpha;
      ctx.textAlign = 'center';

      const lineW = 120 * cardAlpha;
      ctx.fillStyle = `${color}66`;
      ctx.fillRect(GAME_W / 2 - lineW / 2, GAME_H / 2 - 28, lineW, 1);

      ctx.font = '14px "Press Start 2P", monospace';
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = color;
      ctx.fillText(this.zoneTransitionName.toUpperCase(), GAME_W / 2, GAME_H / 2 - 8);
      ctx.shadowBlur = 6;
      ctx.fillText(this.zoneTransitionName.toUpperCase(), GAME_W / 2, GAME_H / 2 - 8);

      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillStyle = '#8899aa';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(`\u2014 Depth: ${this.zoneTransitionDepth}m \u2014`, GAME_W / 2, GAME_H / 2 + 12);

      ctx.fillStyle = `${color}66`;
      ctx.fillRect(GAME_W / 2 - lineW / 2, GAME_H / 2 + 22, lineW, 1);

      const flavorTexts = [
        'Eerie calm... something feels wrong.',
        'The kelp closes in around you.',
        'Flickering lights. Broken glass. Answers.',
        'Pressure mounts. The abyss watches.',
        'The heart of the corruption pulses.',
      ];
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillStyle = `${color}88`;
      ctx.shadowBlur = 0;
      ctx.fillText(flavorTexts[Math.min(zone, 4)], GAME_W / 2, GAME_H / 2 + 36);
      ctx.restore();
    }

    // Phase 3 (1.0 → 0): Pixel dissolve wipe OUT from center
    if (t <= 1.0 && t > 0) {
      const progress = 1 - t / 1.0;
      const blockSize = 10;
      for (let bx = 0; bx < GAME_W; bx += blockSize) {
        for (let by = 0; by < GAME_H; by += blockSize) {
          const h = hashFn(bx, by);
          const centerDist = Math.sqrt(
            Math.pow((bx - GAME_W / 2) / (GAME_W / 2), 2) +
            Math.pow((by - GAME_H / 2) / (GAME_H / 2), 2)
          );
          if (h > progress * 1.5 - centerDist * 0.3) {
            const alpha = Math.min(1, (h - progress * 1.5 + centerDist * 0.3) * 3);
            ctx.fillStyle = `rgba(0, 0, 5, ${0.9 * alpha})`;
            ctx.fillRect(bx, by, blockSize, blockSize);
          }
        }
      }
    }
  }

  // Public methods for UI
  moveInventoryToQuickslot(invIndex: number, qsIndex: number) {
    const p = this.state.player;
    const temp = p.quickslots[qsIndex];
    p.quickslots[qsIndex] = p.inventory[invIndex];
    p.inventory[invIndex] = temp;
    this.callbacks.onStateUpdate({ ...this.state });
  }

  dropInventoryItem(invIndex: number) {
    const p = this.state.player;
    const slot = p.inventory[invIndex];
    if (slot) {
      this.state.droppedItems.push({
        pos: { x: p.pos.x, y: p.pos.y },
        vel: { x: p.facing * 20, y: -15 },
        item: slot.item, count: slot.count, lifetime: 30,
        bobOffset: Math.random() * Math.PI * 2,
      });
      p.inventory[invIndex] = null;
      this.callbacks.onStateUpdate({ ...this.state });
    }
  }

  restart() {
    this.state = this.createInitialState();
    this.deathActive = false;
    this.deathSequence = 0;
    this.helmetCracks = 0;
    this.damageFlash = 0;
    this.screenShake = { intensity: 0, duration: 0, timer: 0 };
    this.callbacks.onStateUpdate({ ...this.state });
  }

  craftItem(recipeId: string) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;
    const p = this.state.player;
    const allSlots = [...p.inventory, ...p.quickslots];
    if (!canCraft(recipe, allSlots)) return;

    // Remove ingredients from inventory first, then quickslots
    const remaining = new Map(recipe.ingredients.map(i => [i.itemId, i.count]));
    for (let i = 0; i < p.inventory.length && remaining.size > 0; i++) {
      const slot = p.inventory[i];
      if (!slot) continue;
      const need = remaining.get(slot.item.id);
      if (need === undefined) continue;
      const take = Math.min(need, slot.count);
      slot.count -= take;
      if (slot.count <= 0) p.inventory[i] = null;
      const left = need - take;
      if (left <= 0) remaining.delete(slot.item.id);
      else remaining.set(slot.item.id, left);
    }
    for (let i = 0; i < p.quickslots.length && remaining.size > 0; i++) {
      const slot = p.quickslots[i];
      if (!slot) continue;
      const need = remaining.get(slot.item.id);
      if (need === undefined) continue;
      const take = Math.min(need, slot.count);
      slot.count -= take;
      if (slot.count <= 0) p.quickslots[i] = null;
      const left = need - take;
      if (left <= 0) remaining.delete(slot.item.id);
      else remaining.set(slot.item.id, left);
    }

    // Add result to first empty inventory slot
    const resultItem = ITEMS[recipe.result.itemId];
    if (!resultItem) return;
    const emptyIdx = p.inventory.findIndex(s => s === null);
    if (emptyIdx !== -1) {
      p.inventory[emptyIdx] = { item: resultItem, count: recipe.result.count };
    }
    // Could also stack if stackable — keeping simple for now

    this.callbacks.onStateUpdate({ ...this.state });
  }

  // ======== NPC SYSTEM ========

  spawnNPCs(terrain: number[]): NPCState[] {
    return NPC_DEFS.map(def => {
      const zoneMinX = def.zone * (WORLD_W / 5);
      const zoneMaxX = (def.zone + 1) * (WORLD_W / 5);
      const x = zoneMinX + (zoneMaxX - zoneMinX) * def.xOffset;
      const tx = terrain[Math.floor(Math.min(x, terrain.length - 1))];
      return {
        id: def.id,
        def,
        pos: { x, y: tx - 30 },
        interacting: false,
        currentDialogue: null,
        currentLine: 0,
        completedNodes: [],
        bobble: Math.random() * Math.PI * 2,
      };
    });
  }

  updateNPCs(dt: number) {
    for (const npc of this.state.npcs) {
      npc.bobble += dt * 1.5;
    }
  }

  getNearbyNPC(): NPCState | null {
    const p = this.state.player;
    const px = p.pos.x + p.width / 2;
    const py = p.pos.y + p.height / 2;
    for (const npc of this.state.npcs) {
      const dx = px - npc.pos.x;
      const dy = py - npc.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 50) return npc;
    }
    return null;
  }

  tryInteractNPC(): boolean {
    const npc = this.getNearbyNPC();
    if (!npc) return false;

    // Find next uncompleted dialogue node
    const nextNode = npc.def.dialogue.find(d => !npc.completedNodes.includes(d.id));
    if (!nextNode) return false; // all dialogue exhausted

    this.state.activeDialogue = { npcId: npc.id, nodeId: nextNode.id, lineIndex: 0 };
    this.state.paused = true;
    this.callbacks.onStateUpdate({ ...this.state });
    return true;
  }

  advanceDialogue() {
    const ad = this.state.activeDialogue;
    if (!ad) return;

    const npc = this.state.npcs.find(n => n.id === ad.npcId);
    if (!npc) return;

    const node = npc.def.dialogue.find(d => d.id === ad.nodeId);
    if (!node) return;

    if (ad.lineIndex < node.lines.length - 1) {
      // Next line
      ad.lineIndex++;
    } else {
      // Dialogue node complete — give reward
      if (node.reward) {
        const item = ITEMS[node.reward.itemId];
        if (item) {
          this.addToInventory(item, node.reward.count);
          this.callbacks.onItemPickup(item, node.reward.count);
        }
      }
      npc.completedNodes.push(node.id);
      this.state.activeDialogue = null;
      this.state.paused = false;
    }
    this.callbacks.onStateUpdate({ ...this.state });
  }

  // addToInventory already defined above

  renderNPCs(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const p = this.state.player;
    const px = p.pos.x + p.width / 2;
    const py = p.pos.y + p.height / 2;

    for (const npc of this.state.npcs) {
      const sx = npc.pos.x - cam.x;
      const sy = npc.pos.y - cam.y + Math.sin(npc.bobble) * 3;

      // Skip if off screen
      if (sx < -40 || sx > GAME_W + 40 || sy < -40 || sy > GAME_H + 40) continue;

      ctx.save();
      ctx.translate(sx, sy);

      // Draw NPC sprite based on type
      this.drawNPCSprite(ctx, npc);

      // Draw name tag and interact prompt
      const dx = px - npc.pos.x;
      const dy = py - npc.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Name always visible (when close enough to see)
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = npc.def.color;
      ctx.shadowColor = npc.def.color;
      ctx.shadowBlur = 6;
      ctx.fillText(npc.def.name, 0, -26);
      ctx.shadowBlur = 0;

      // Interact prompt when close
      if (dist < 50) {
        const hasDialogue = npc.def.dialogue.some(d => !npc.completedNodes.includes(d.id));
        if (hasDialogue) {
          const pulse = 0.6 + Math.sin(this.state.time * 4) * 0.4;
          ctx.globalAlpha = pulse;
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.fillStyle = '#88ccff';
          ctx.fillText('[E] Talk', 0, -34);
          ctx.globalAlpha = 1;
        } else {
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.fillStyle = '#667788';
          ctx.fillText('...', 0, -34);
        }
      }

      ctx.restore();
    }
  }

  drawNPCSprite(ctx: CanvasRenderingContext2D, npc: NPCState) {
    switch (npc.def.spriteType) {
      case 'mara': {
        // Mara: stranded diver - similar to player but with distinct orange suit
        const bob = Math.sin(npc.bobble) * 2;
        // Body - orange dive suit
        ctx.fillStyle = '#cc6622';
        ctx.fillRect(-5, -5 + bob, 10, 14);
        ctx.fillStyle = '#dd7733';
        ctx.fillRect(-4, -3 + bob, 8, 2);
        // Belt
        ctx.fillStyle = '#886644';
        ctx.fillRect(-5, 5 + bob, 10, 2);
        // Helmet
        ctx.fillStyle = '#998877';
        ctx.fillRect(-4, -11 + bob, 8, 7);
        ctx.fillStyle = '#aa9988';
        ctx.fillRect(-5, -5 + bob, 10, 1);
        // Visor - warm yellow
        ctx.fillStyle = '#ffcc66';
        ctx.fillRect(-2, -10 + bob, 5, 5);
        ctx.fillStyle = 'rgba(255, 220, 150, 0.4)';
        ctx.fillRect(-1, -9 + bob, 3, 3);
        // Legs
        ctx.fillStyle = '#cc6622';
        ctx.fillRect(-4, 7 + bob, 3, 5);
        ctx.fillRect(1, 7 + bob, 3, 5);
        // Flippers
        ctx.fillStyle = '#dd8844';
        ctx.fillRect(-5, 11 + bob, 4, 2);
        ctx.fillRect(1, 11 + bob, 4, 2);
        // Glow
        ctx.shadowColor = '#ffaa44';
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(255, 170, 68, 0.15)';
        ctx.fillRect(-8, -14 + bob, 16, 30);
        ctx.shadowBlur = 0;
        break;
      }
      case 'dr_hess': {
        // Dr. Hess: lab coat over wetsuit, glasses
        const bob = Math.sin(npc.bobble) * 2;
        // Lab coat (white-ish)
        ctx.fillStyle = '#ccccbb';
        ctx.fillRect(-6, -6 + bob, 12, 16);
        ctx.fillStyle = '#ddddcc';
        ctx.fillRect(-5, -4 + bob, 10, 2);
        // Coat buttons
        ctx.fillStyle = '#888877';
        ctx.fillRect(0, -2 + bob, 1, 1);
        ctx.fillRect(0, 1 + bob, 1, 1);
        ctx.fillRect(0, 4 + bob, 1, 1);
        // Wetsuit underneath
        ctx.fillStyle = '#334455';
        ctx.fillRect(-4, -3 + bob, 2, 10);
        ctx.fillRect(2, -3 + bob, 2, 10);
        // Head - bald with glasses
        ctx.fillStyle = '#ddbbaa';
        ctx.fillRect(-3, -12 + bob, 6, 7);
        // Glasses
        ctx.fillStyle = '#4488aa';
        ctx.fillRect(-3, -10 + bob, 3, 2);
        ctx.fillRect(1, -10 + bob, 3, 2);
        ctx.fillStyle = '#667788';
        ctx.fillRect(-1, -10 + bob, 2, 1);
        // Legs
        ctx.fillStyle = '#ccccbb';
        ctx.fillRect(-4, 8 + bob, 3, 4);
        ctx.fillRect(1, 8 + bob, 3, 4);
        // Boots
        ctx.fillStyle = '#445566';
        ctx.fillRect(-4, 11 + bob, 3, 2);
        ctx.fillRect(1, 11 + bob, 3, 2);
        // Glow
        ctx.shadowColor = '#66cc88';
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(100, 200, 130, 0.12)';
        ctx.fillRect(-8, -14 + bob, 16, 30);
        ctx.shadowBlur = 0;
        break;
      }
      case 'subject_7': {
        // Subject 7: half-corrupted diver, purple corruption veins
        const bob = Math.sin(npc.bobble) * 2;
        const pulse = 0.6 + Math.sin(this.state.time * 3) * 0.4;
        // Body - torn suit
        ctx.fillStyle = '#3a2a4a';
        ctx.fillRect(-5, -5 + bob, 10, 14);
        // Corruption veins
        ctx.fillStyle = `rgba(170, 85, 255, ${pulse * 0.6})`;
        ctx.fillRect(-4, -3 + bob, 1, 8);
        ctx.fillRect(3, -1 + bob, 1, 6);
        ctx.fillRect(-2, 2 + bob, 6, 1);
        // Exposed flesh/corruption on arm
        ctx.fillStyle = '#8844aa';
        ctx.fillRect(4, -2 + bob, 2, 5);
        // Head - partially corrupted
        ctx.fillStyle = '#bbaa99';
        ctx.fillRect(-3, -12 + bob, 3, 7);
        // Corrupted half
        ctx.fillStyle = '#6633aa';
        ctx.fillRect(0, -12 + bob, 3, 7);
        // Eye (normal side)
        ctx.fillStyle = '#88ccff';
        ctx.fillRect(-2, -10 + bob, 2, 2);
        // Eye (corrupted side) - glowing
        ctx.fillStyle = `rgba(200, 100, 255, ${pulse})`;
        ctx.fillRect(1, -10 + bob, 2, 2);
        // Legs
        ctx.fillStyle = '#3a2a4a';
        ctx.fillRect(-4, 7 + bob, 3, 5);
        ctx.fillRect(1, 7 + bob, 3, 5);
        // Corruption glow
        ctx.shadowColor = '#aa55ff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgba(170, 85, 255, ${pulse * 0.1})`;
        ctx.fillRect(-8, -14 + bob, 16, 30);
        ctx.shadowBlur = 0;
        break;
      }
    }
  }

  renderDialogueOverlay(ctx: CanvasRenderingContext2D) {
    const ad = this.state.activeDialogue;
    if (!ad) return;

    const npc = this.state.npcs.find(n => n.id === ad.npcId);
    if (!npc) return;
    const node = npc.def.dialogue.find(d => d.id === ad.nodeId);
    if (!node) return;
    const line = node.lines[ad.lineIndex];
    if (!line) return;

    // Darken background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Dialogue box
    const boxH = 90;
    const boxY = GAME_H - boxH - 10;
    const boxX = 20;
    const boxW = GAME_W - 40;

    // Box background
    ctx.fillStyle = 'rgba(10, 18, 30, 0.95)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    // Border
    ctx.strokeStyle = npc.def.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = npc.def.color;
    ctx.shadowBlur = 8;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.shadowBlur = 0;

    // Speaker icon and name
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = npc.def.color;
    ctx.fillText(`${line.icon} ${line.speaker}`, boxX + 10, boxY + 16);

    // Dialogue text - word wrap
    ctx.font = '12px "VT323", monospace';
    ctx.fillStyle = '#c8d0d8';
    const maxWidth = boxW - 30;
    const words = line.text.split(' ');
    let currentLine = '';
    let lineY = boxY + 34;

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth) {
        ctx.fillText(currentLine, boxX + 12, lineY);
        currentLine = word;
        lineY += 16;
      } else {
        currentLine = testLine;
      }
    }
    ctx.fillText(currentLine, boxX + 12, lineY);

    // Progress indicator
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#556677';
    ctx.fillText(`${ad.lineIndex + 1}/${node.lines.length}`, boxX + boxW - 10, boxY + 16);

    // Continue prompt
    const pulse = 0.5 + Math.sin(this.state.time * 5) * 0.5;
    ctx.globalAlpha = pulse;
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = '#88ccff';
    ctx.fillText(ad.lineIndex < node.lines.length - 1 ? '[F/SPACE] Continue' : '[F/SPACE] Close', boxX + boxW - 10, boxY + boxH - 8);
    ctx.globalAlpha = 1;

    // Reward preview on last line
    if (ad.lineIndex === node.lines.length - 1 && node.reward) {
      const item = ITEMS[node.reward.itemId];
      if (item) {
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = RARITY_COLORS[item.rarity];
        ctx.fillText(`Reward: ${item.icon} ${item.name} x${node.reward.count}`, boxX + 10, boxY + boxH - 8);
      }
    }
  }
}
