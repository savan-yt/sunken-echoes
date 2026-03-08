import {
  GameState, Player, Creature, Projectile, DroppedItem, AirBubble, Particle,
  Vec2, GameCallbacks, RARITY_COLORS, ItemDef, BossState, MemoryFragment,
} from './types';
import { ITEMS, CREATURE_TEMPLATES, BOSS_TEMPLATES } from './data';
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
const OXYGEN_DRAIN = 2;

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

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.callbacks = callbacks;
    canvas.width = GAME_W;
    canvas.height = GAME_H;

    this.state = this.createInitialState();
    this.bindInput();
  }

  createInitialState(): GameState {
    const terrain = this.generateTerrain();
    const kelp = this.generateKelp(terrain);
    const rocks = this.generateRocks(terrain);
    const airBubbles = this.generateAirBubbles(terrain);
    const creatures = this.spawnCreatures(terrain);

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
    const templates = Object.values(CREATURE_TEMPLATES);
    for (let i = 0; i < 30; i++) {
      const tmpl = templates[Math.floor(Math.random() * templates.length)];
      const x = 200 + Math.random() * (WORLD_W - 400);
      const tx = terrain[Math.floor(Math.min(x, terrain.length - 1))];
      const y = tx - 40 - Math.random() * 200;
      creatures.push({
        id: `c_${i}`,
        ...tmpl,
        pos: { x, y },
        vel: { x: 0, y: 0 },
        facing: Math.random() > 0.5 ? 1 : -1,
        state: 'patrol',
        attackCooldown: 0,
        patrolOrigin: { x, y },
        deathTimer: 0,
        rangedCooldown: 0,
        maxHp: tmpl.hp,
        animFrame: 0,
        animTimer: 0,
        corruptionPulse: Math.random() * Math.PI * 2,
        xpValue: tmpl.xpValue,
      });
    }

    // Spawn Rotjaw boss at x=1800 (end of zone 1)
    const bossX = 1800;
    const bossTx = terrain[Math.floor(bossX)];
    const bossY = bossTx - 80;
    const bossTmpl = BOSS_TEMPLATES.rotjaw;
    const bossId = 'boss_rotjaw';
    creatures.push({
      id: bossId,
      name: bossTmpl.name,
      hp: bossTmpl.hp,
      maxHp: bossTmpl.hp,
      damage: bossTmpl.damage,
      speed: bossTmpl.speed,
      behavior: bossTmpl.behavior,
      attackRange: bossTmpl.attackRange,
      patrolRange: bossTmpl.patrolRange,
      width: bossTmpl.width,
      height: bossTmpl.height,
      spriteType: bossTmpl.spriteType,
      xpValue: bossTmpl.xpValue,
      lootTable: bossTmpl.lootTable,
      pos: { x: bossX, y: bossY },
      vel: { x: 0, y: 0 },
      facing: -1,
      state: 'patrol',
      attackCooldown: 0,
      patrolOrigin: { x: bossX, y: bossY },
      deathTimer: 0,
      rangedCooldown: 0,
      animFrame: 0,
      animTimer: 0,
      corruptionPulse: 0,
    });

    return creatures;
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
        this.useActiveQuickslot();
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
    }
    this.render();
    this.state.time += dt;
    this.animFrame = requestAnimationFrame(this.loop);
  };

  update(dt: number) {
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
    // Update depth zone
    this.state.depthZone = Math.min(4, Math.floor(this.state.player.pos.y / (WORLD_H / 5)));
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
      case 'reinforced_harpoon': return 8;   // +50% of base ~15
      case 'venomous_harpoon': return 12;    // poison-tier damage
      case 'abyssal_lance': return 20;       // devastating
      default: return 0;
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
    p.vel.x *= 1 - WATER_DRAG * dt;
    p.vel.y *= 1 - WATER_DRAG * dt;

    const maxSpeed = SWIM_SPEED * speedMult;
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
    p.oxygen -= OXYGEN_DRAIN * depthFactor * divingReduction * dt;
    if (p.oxygen <= 0) {
      p.oxygen = 0;
      p.hp -= 10 * dt;
    }
    if (p.hp <= 0) {
      this.state.gameOver = true;
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
      if (proj.pos.y > this.state.terrain[tx]) return false;

      if (proj.fromPlayer) {
        for (const c of this.state.creatures) {
          if (c.state === 'dead') continue;
          if (this.aabb(proj, c)) {
            c.hp -= proj.damage;
            c.state = 'chase';
            this.spawnDamageParticles(c.pos.x + c.width / 2, c.pos.y + c.height / 2, proj.type === 'harpoon_crit');
            if (c.hp <= 0) this.killCreature(c);
            return false;
          }
        }
      } else {
        const p = this.state.player;
        if (p.invincible <= 0 && this.aabb(proj, p)) {
          const defense = this.getStatBonus('defense');
          const dmg = Math.max(1, proj.damage - defense);
          p.hp -= dmg;
          p.invincible = 0.5;
          this.spawnDamageParticles(p.pos.x + p.width / 2, p.pos.y + p.height / 2, false);
          if (p.hp <= 0) {
            this.state.gameOver = true;
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
    c.deathTimer = 2;
    this.callbacks.onCreatureKill(c.name);
    this.state.score += 10;

    // Grant XP based on creature
    const xpGain = c.xpValue || (15 + Math.floor(Math.random() * 10));
    this.state.skills.xp += xpGain;
    if (this.state.skills.xp >= 100) {
      this.state.skills.xp -= 100;
      this.state.skills.level++;
      this.state.skills.skillPoints += 2;
      this.state.skills.statPoints += 3;
    }

    // Boss death — drop memory fragment
    if (c.id === 'boss_rotjaw') {
      this.state.boss.defeated = true;
      this.state.boss.active = false;
      c.deathTimer = 4; // longer death for boss
      const tmpl = BOSS_TEMPLATES.rotjaw;
      this.state.memoryFragments.push({
        pos: { x: c.pos.x + c.width / 2, y: c.pos.y },
        vel: { x: 0, y: -15 },
        lifetime: 60,
        bobOffset: 0,
        collected: false,
        collectTimer: 0,
        title: tmpl.memoryFragment.title,
        text: tmpl.memoryFragment.text,
      });
      // Massive boss death explosion
      for (let i = 0; i < 30; i++) {
        this.state.particles.push({
          pos: { x: c.pos.x + c.width / 2, y: c.pos.y + c.height / 2 },
          vel: { x: (Math.random() - 0.5) * 120, y: (Math.random() - 0.5) * 120 },
          lifetime: 2, maxLifetime: 2, size: 3 + Math.random() * 4,
          color: Math.random() > 0.5 ? '#ff2244' : '#aa22ff', type: 'damage',
        });
      }
      for (let i = 0; i < 20; i++) {
        this.state.particles.push({
          pos: { x: c.pos.x + c.width / 2, y: c.pos.y + c.height / 2 },
          vel: { x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80 },
          lifetime: 3, maxLifetime: 3, size: 2 + Math.random() * 3,
          color: '#cc88ff', type: 'memory',
        });
      }
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

    // Death particles
    for (let i = 0; i < 12; i++) {
      this.state.particles.push({
        pos: { x: c.pos.x + c.width / 2, y: c.pos.y + c.height / 2 },
        vel: { x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80 },
        lifetime: 1, maxLifetime: 1, size: 2 + Math.random() * 3,
        color: '#ff4466', type: 'damage',
      });
    }
    for (let i = 0; i < 6; i++) {
      this.state.particles.push({
        pos: { x: c.pos.x + c.width / 2, y: c.pos.y + c.height / 2 },
        vel: { x: (Math.random() - 0.5) * 50, y: (Math.random() - 0.5) * 50 },
        lifetime: 1.5, maxLifetime: 1.5, size: 3 + Math.random() * 2,
        color: '#aa22ff', type: 'corruption',
      });
    }
  }

  updateBoss(dt: number) {
    const boss = this.state.boss;
    if (boss.defeated) return;

    const bossCreature = this.state.creatures.find(c => c.id === 'boss_rotjaw');
    if (!bossCreature || bossCreature.state === 'dead') return;

    const p = this.state.player;
    const dx = p.pos.x - bossCreature.pos.x;
    const dy = p.pos.y - bossCreature.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Activate boss when player is near
    if (!boss.active && dist < 250) {
      boss.active = true;
      boss.creatureId = bossCreature.id;
      bossCreature.state = 'chase';
    }

    if (!boss.active) return;

    // Determine phase based on HP
    const hpPct = bossCreature.hp / bossCreature.maxHp;
    const newPhase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
    if (newPhase !== boss.phase) {
      boss.phase = newPhase as 1 | 2 | 3;
      boss.phaseTransition = 1.5;
      // Phase transition roar — particles burst
      for (let i = 0; i < 15; i++) {
        this.state.particles.push({
          pos: { x: bossCreature.pos.x + bossCreature.width / 2, y: bossCreature.pos.y + bossCreature.height / 2 },
          vel: { x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 100 },
          lifetime: 1.5, maxLifetime: 1.5, size: 3 + Math.random() * 3,
          color: newPhase === 3 ? '#ff2222' : '#ff6644', type: 'boss_charge',
        });
      }
    }

    if (boss.phaseTransition > 0) {
      boss.phaseTransition -= dt;
      return; // brief invulnerability during transition
    }

    boss.chargeCooldown -= dt;
    boss.comboCooldown -= dt;
    boss.roarTimer -= dt;

    // Phase-specific boss speed multiplier
    const speedMult = boss.phase === 3 ? 1.5 : boss.phase === 2 ? 1.2 : 1;
    bossCreature.speed = 70 * speedMult;

    // CHARGE ATTACK
    if (boss.isCharging) {
      boss.chargeTimer -= dt;
      bossCreature.vel.x = boss.chargeDir.x * 180 * speedMult;
      bossCreature.vel.y = boss.chargeDir.y * 180 * speedMult;

      // Charge trail particles
      if (Math.random() < 0.5) {
        this.state.particles.push({
          pos: { x: bossCreature.pos.x + bossCreature.width / 2, y: bossCreature.pos.y + bossCreature.height / 2 },
          vel: { x: -boss.chargeDir.x * 30 + (Math.random() - 0.5) * 20, y: -boss.chargeDir.y * 30 + (Math.random() - 0.5) * 20 },
          lifetime: 0.6, maxLifetime: 0.6, size: 3,
          color: '#ff4422', type: 'boss_charge',
        });
      }

      // Check hit during charge
      if (dist < 40 && p.invincible <= 0) {
        const chargeDmg = Math.floor(bossCreature.damage * 1.5);
        const defense = this.getStatBonus('defense');
        p.hp -= Math.max(1, chargeDmg - defense);
        p.invincible = 0.8;
        p.vel.x += boss.chargeDir.x * 150;
        p.vel.y += boss.chargeDir.y * 80;
        this.spawnDamageParticles(p.pos.x, p.pos.y, false);
      }

      if (boss.chargeTimer <= 0) {
        boss.isCharging = false;
        boss.chargeCooldown = boss.phase === 3 ? 2 : boss.phase === 2 ? 3 : 4;
      }
      return;
    }

    // Initiate charge attack
    if (boss.chargeCooldown <= 0 && dist < 300 && dist > 60) {
      const nd = dist || 1;
      boss.chargeDir = { x: dx / nd, y: dy / nd };
      boss.isCharging = true;
      boss.chargeTimer = 0.6;
      boss.chargeCooldown = 5;
      // Charge windup particles
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
            const dmg = Math.max(1, Math.floor(bossCreature.damage * 0.8) - defense);
            p.hp -= dmg;
            p.invincible = 0.3;
            this.spawnDamageParticles(p.pos.x + p.width / 2, p.pos.y + p.height / 2, false);
            if (p.hp <= 0) {
              this.state.gameOver = true;
              this.callbacks.onPlayerDeath();
            }
          }
        }, hit * 300);
      }
      boss.comboCooldown = boss.phase === 3 ? 2.5 : 4;
      boss.comboCount++;
    }

    // Phase 3: fire projectiles periodically
    if (boss.phase === 3 && bossCreature.rangedCooldown <= 0 && dist < 250) {
      const nd = dist || 1;
      // Spread shot — 3 projectiles
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

      if (c.state === 'dead') {
        c.deathTimer -= dt;
        if (c.deathTimer <= 0) {
          // Boss doesn't respawn
          if (c.id === 'boss_rotjaw') continue;
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
          const dmg = Math.max(1, c.damage - defense);
          p.hp -= dmg;
          p.invincible = 0.5;
          c.attackCooldown = 1;
          this.spawnDamageParticles(p.pos.x + p.width / 2, p.pos.y + p.height / 2, false);
          if (p.hp <= 0) {
            this.state.gameOver = true;
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
    // Zone-specific particles
    const zone = this.state.depthZone;
    if (zone >= 3 && Math.random() < 1 * dt) {
      // Corruption specks in deep zones
      this.state.particles.push({
        pos: {
          x: this.state.camera.x + Math.random() * GAME_W,
          y: this.state.camera.y + Math.random() * GAME_H,
        },
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

  // ================ RENDERING ================

  render() {
    const ctx = this.ctx;
    const cam = this.state.camera;
    ctx.imageSmoothingEnabled = false;

    this.renderBackground(ctx, cam);
    this.renderParallaxLayers(ctx, cam);
    this.renderTerrain(ctx, cam);
    this.renderKelp(ctx, cam);
    this.renderRocks(ctx, cam);
    this.renderAirBubbles(ctx, cam);
    this.renderDroppedItems(ctx, cam);
    this.renderMemoryFragments(ctx, cam);
    this.renderCreatures(ctx, cam);
    this.renderBossHPBar(ctx);
    this.renderPlayer(ctx, cam);
    this.renderProjectiles(ctx, cam);
    this.renderParticles(ctx, cam);
    this.renderHelmetLight(ctx, cam);
    this.renderLightRays(ctx, cam);
    this.renderWaterDistortion(ctx);
    this.renderVignette(ctx);
    this.renderZoneOverlay(ctx);
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

      this.drawCreatureSprite(ctx, c);

      ctx.restore();

      // HP bar (improved)
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
    const bossCreature = this.state.creatures.find(c => c.id === 'boss_rotjaw');
    if (!bossCreature || bossCreature.state === 'dead') return;

    const barW = 300;
    const barH = 8;
    const bx = (GAME_W - barW) / 2;
    const by = 12;
    const hpPct = bossCreature.hp / bossCreature.maxHp;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

    // HP fill with phase color
    const phaseColors = ['#cc4444', '#ff6622', '#ff2222'];
    ctx.fillStyle = phaseColors[boss.phase - 1];
    ctx.fillRect(bx, by, barW * hpPct, barH);

    // Phase markers
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(bx + barW * 0.6, by, 1, barH);
    ctx.fillRect(bx + barW * 0.3, by, 1, barH);

    // Boss name
    ctx.fillStyle = '#ff8866';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠ ROTJAW — Phase ${boss.phase} ⚠`, GAME_W / 2, by - 3);

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

    // Swim bubbles trail
    if (isMoving) {
      if (Math.random() < 0.35) {
        this.state.particles.push({
          pos: { x: p.pos.x - p.facing * 6, y: p.pos.y + 3 },
          vel: { x: -p.facing * 8, y: -6 },
          lifetime: 0.9, maxLifetime: 0.9, size: 1 + Math.random() * 1.5,
          color: 'rgba(150, 220, 255, 0.4)', type: 'bubble',
        });
      }
    }
  }

  renderHelmetLight(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const p = this.state.player;
    const zone = this.state.depthZone;
    if (zone < 2) return; // Only show in darker zones

    const sx = p.pos.x - cam.x + p.width / 2;
    const sy = p.pos.y - cam.y + p.height / 2 - 8;
    const dir = p.facing;
    const intensity = Math.min(1, (zone - 1) * 0.35);
    const flicker = 0.9 + Math.sin(this.state.time * 7) * 0.1;

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
    // Subtle wave lines across screen
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = '#aaddff';
    ctx.lineWidth = 1;
    for (let y = 0; y < GAME_H; y += 40) {
      const wave = Math.sin(this.state.time * 0.8 + y * 0.05) * 3;
      ctx.beginPath();
      ctx.moveTo(0, y + wave);
      for (let x = 0; x < GAME_W; x += 20) {
        const wy = y + Math.sin(this.state.time * 0.6 + x * 0.02 + y * 0.03) * 2;
        ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
}
