import {
  GameState, Player, Creature, Projectile, DroppedItem, AirBubble, Particle,
  Vec2, GameCallbacks, RARITY_COLORS, ItemDef,
} from './types';
import { ITEMS, CREATURE_TEMPLATES } from './data';

const GAME_W = 480;
const GAME_H = 270;
const GRAVITY = 30; // gentle downward pull (underwater)
const SWIM_SPEED = 90;
const SWIM_ACCEL = 400;
const WATER_DRAG = 3;
const WORLD_W = 2400;
const WORLD_H = 800;
const HARPOON_SPEED = 200;
const HARPOON_DAMAGE = 10;
const OXYGEN_DRAIN = 2; // per second in shallows

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
      pos: { x: 100, y: terrain[100] - 40 },
      vel: { x: 0, y: 0 },
      width: 10, height: 16,
      facing: 1, oxygen: 100, maxOxygen: 100,
      hp: 100, maxHp: 100,
      shootCooldown: 0, invincible: 0,
      inventory: Array(25).fill(null),
      quickslots: Array(6).fill(null),
      activeQuickslot: 0,
    };
    // Give starting items
    player.quickslots[0] = { item: ITEMS.rusty_harpoon, count: 1 };
    player.inventory[0] = { item: ITEMS.oxygen_canister, count: 2 };

    return {
      player, creatures, projectiles: [], droppedItems: [],
      airBubbles, particles: [], camera: { x: 0, y: 0 },
      worldWidth: WORLD_W, worldHeight: WORLD_H,
      terrain, kelp, rocks, time: 0, score: 0,
      gameOver: false, paused: false, showInventory: false,
    };
  }

  generateTerrain(): number[] {
    const t: number[] = [];
    for (let x = 0; x < WORLD_W; x++) {
      const base = WORLD_H - 80;
      const hill = Math.sin(x * 0.008) * 40 + Math.sin(x * 0.025) * 20 + Math.sin(x * 0.06) * 10;
      const cave = Math.sin(x * 0.015) > 0.7 ? Math.sin(x * 0.015) * 30 : 0;
      t[x] = Math.floor(base + hill - cave);
    }
    return t;
  }

  generateKelp(terrain: number[]) {
    const kelps: GameState['kelp'] = [];
    for (let x = 50; x < WORLD_W - 50; x += 15 + Math.floor(Math.random() * 30)) {
      if (Math.random() < 0.6) {
        kelps.push({ x, height: 30 + Math.random() * 60, phase: Math.random() * Math.PI * 2 });
      }
    }
    return kelps;
  }

  generateRocks(terrain: number[]) {
    const rocks: GameState['rocks'] = [];
    for (let x = 30; x < WORLD_W - 30; x += 20 + Math.floor(Math.random() * 50)) {
      if (Math.random() < 0.4) {
        rocks.push({ x, y: terrain[x], size: 3 + Math.random() * 8 });
      }
    }
    return rocks;
  }

  generateAirBubbles(terrain: number[]): AirBubble[] {
    const bubbles: AirBubble[] = [];
    for (let x = 80; x < WORLD_W - 80; x += 100 + Math.floor(Math.random() * 150)) {
      const ty = terrain[Math.min(x, terrain.length - 1)];
      bubbles.push({
        pos: { x, y: ty - 30 - Math.random() * 60 },
        size: 6, active: true, respawnTimer: 0,
      });
    }
    return bubbles;
  }

  spawnCreatures(terrain: number[]): Creature[] {
    const creatures: Creature[] = [];
    const templates = Object.values(CREATURE_TEMPLATES);
    for (let i = 0; i < 20; i++) {
      const tmpl = templates[Math.floor(Math.random() * templates.length)];
      const x = 200 + Math.random() * (WORLD_W - 400);
      const tx = terrain[Math.floor(Math.min(x, terrain.length - 1))];
      const y = tx - 30 - Math.random() * 150;
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
      });
    }
    return creatures;
  }

  bindInput() {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (down) this.keys.add(e.key.toLowerCase());
      else this.keys.delete(e.key.toLowerCase());

      if (down && e.key.toLowerCase() === 'i') {
        this.state.showInventory = !this.state.showInventory;
        this.state.paused = this.state.showInventory;
        this.callbacks.onStateUpdate({ ...this.state });
      }
      if (down && e.key >= '1' && e.key <= '6') {
        this.state.player.activeQuickslot = parseInt(e.key) - 1;
        this.callbacks.onStateUpdate({ ...this.state });
      }
      // Use quickslot item with E
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
    this.updateDroppedItems(dt);
    this.updateAirBubbles(dt);
    this.updateParticles(dt);
    this.updateCamera();
    this.spawnAmbientParticles(dt);
    this.callbacks.onStateUpdate({ ...this.state });
  }

  updatePlayer(dt: number) {
    const p = this.state.player;
    let ax = 0, ay = 0;

    if (this.keys.has('a') || this.keys.has('arrowleft')) { ax -= SWIM_ACCEL; p.facing = -1; }
    if (this.keys.has('d') || this.keys.has('arrowright')) { ax += SWIM_ACCEL; p.facing = 1; }
    if (this.keys.has('w') || this.keys.has('arrowup')) ay -= SWIM_ACCEL;
    if (this.keys.has('s') || this.keys.has('arrowdown')) ay += SWIM_ACCEL;

    // Apply swimming force
    p.vel.x += ax * dt;
    p.vel.y += (ay + GRAVITY) * dt;

    // Water drag
    p.vel.x *= 1 - WATER_DRAG * dt;
    p.vel.y *= 1 - WATER_DRAG * dt;

    // Speed cap
    const speed = Math.sqrt(p.vel.x ** 2 + p.vel.y ** 2);
    if (speed > SWIM_SPEED) {
      p.vel.x = (p.vel.x / speed) * SWIM_SPEED;
      p.vel.y = (p.vel.y / speed) * SWIM_SPEED;
    }

    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;

    // World bounds
    p.pos.x = Math.max(5, Math.min(WORLD_W - 5, p.pos.x));
    p.pos.y = Math.max(10, Math.min(WORLD_H - 20, p.pos.y));

    // Terrain collision
    const tx = Math.floor(Math.max(0, Math.min(p.pos.x, this.state.terrain.length - 1)));
    const terrainY = this.state.terrain[tx];
    if (p.pos.y + p.height > terrainY) {
      p.pos.y = terrainY - p.height;
      p.vel.y = Math.min(0, p.vel.y);
    }

    // Oxygen
    const depthFactor = 1 + (p.pos.y / WORLD_H) * 2;
    p.oxygen -= OXYGEN_DRAIN * depthFactor * dt;
    if (p.oxygen <= 0) {
      p.oxygen = 0;
      p.hp -= 10 * dt;
    }
    if (p.hp <= 0) {
      this.state.gameOver = true;
      this.callbacks.onPlayerDeath();
    }

    // Shooting
    p.shootCooldown -= dt;
    if ((this.mouseDown || this.keys.has(' ')) && p.shootCooldown <= 0) {
      this.shootHarpoon();
      p.shootCooldown = 0.4;
    }

    // Invincibility frames
    if (p.invincible > 0) p.invincible -= dt;
  }

  shootHarpoon() {
    const p = this.state.player;
    const worldMouseX = this.mouse.x + this.state.camera.x;
    const worldMouseY = this.mouse.y + this.state.camera.y;
    const dx = worldMouseX - (p.pos.x + p.width / 2);
    const dy = worldMouseY - (p.pos.y + p.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    this.state.projectiles.push({
      pos: { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 },
      vel: { x: (dx / dist) * HARPOON_SPEED, y: (dy / dist) * HARPOON_SPEED },
      width: 3, height: 2, damage: HARPOON_DAMAGE,
      lifetime: 1.5, fromPlayer: true, type: 'harpoon',
    });

    // Muzzle particles
    for (let i = 0; i < 3; i++) {
      this.state.particles.push({
        pos: { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 },
        vel: { x: (dx / dist) * 60 + (Math.random() - 0.5) * 30, y: (dy / dist) * 60 + (Math.random() - 0.5) * 30 },
        lifetime: 0.3, maxLifetime: 0.3, size: 2, color: '#66eeff', type: 'bubble',
      });
    }
  }

  updateProjectiles(dt: number) {
    this.state.projectiles = this.state.projectiles.filter(proj => {
      proj.pos.x += proj.vel.x * dt;
      proj.pos.y += proj.vel.y * dt;
      proj.lifetime -= dt;
      if (proj.lifetime <= 0) return false;

      // Check terrain collision
      const tx = Math.floor(Math.max(0, Math.min(proj.pos.x, this.state.terrain.length - 1)));
      if (proj.pos.y > this.state.terrain[tx]) return false;

      if (proj.fromPlayer) {
        // Hit creatures
        for (const c of this.state.creatures) {
          if (c.state === 'dead') continue;
          if (this.aabb(proj, c)) {
            c.hp -= proj.damage;
            c.state = 'chase';
            this.spawnDamageParticles(c.pos.x, c.pos.y);
            if (c.hp <= 0) this.killCreature(c);
            return false;
          }
        }
      } else {
        // Hit player
        const p = this.state.player;
        if (p.invincible <= 0 && this.aabb(proj, p)) {
          p.hp -= proj.damage;
          p.invincible = 0.5;
          this.spawnDamageParticles(p.pos.x, p.pos.y);
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

    // Drop loot
    for (const loot of c.lootTable) {
      if (Math.random() < loot.chance) {
        const item = ITEMS[loot.itemId];
        if (item) {
          const count = loot.minCount + Math.floor(Math.random() * (loot.maxCount - loot.minCount + 1));
          this.state.droppedItems.push({
            pos: { x: c.pos.x + Math.random() * 10, y: c.pos.y },
            vel: { x: (Math.random() - 0.5) * 30, y: -20 - Math.random() * 20 },
            item, count, lifetime: 30,
            bobOffset: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    // Death particles
    for (let i = 0; i < 8; i++) {
      this.state.particles.push({
        pos: { x: c.pos.x + c.width / 2, y: c.pos.y + c.height / 2 },
        vel: { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 60 },
        lifetime: 0.8, maxLifetime: 0.8, size: 2 + Math.random() * 2,
        color: '#ff4466', type: 'damage',
      });
    }
  }

  updateCreatures(dt: number) {
    const p = this.state.player;
    for (const c of this.state.creatures) {
      if (c.state === 'dead') {
        c.deathTimer -= dt;
        if (c.deathTimer <= 0) {
          // Respawn far from player
          const x = p.pos.x + (Math.random() > 0.5 ? 1 : -1) * (400 + Math.random() * 300);
          const clampedX = Math.max(50, Math.min(WORLD_W - 50, x));
          const tx = Math.floor(clampedX);
          c.pos = { x: clampedX, y: this.state.terrain[Math.min(tx, this.state.terrain.length - 1)] - 40 - Math.random() * 80 };
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

      // Behavior
      const detectRange = c.behavior === 'ambush' ? 60 : 120;
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

        // Melee attack
        if (dist < c.attackRange && c.attackCooldown <= 0 && p.invincible <= 0) {
          p.hp -= c.damage;
          p.invincible = 0.5;
          c.attackCooldown = 1;
          this.spawnDamageParticles(p.pos.x, p.pos.y);
          if (p.hp <= 0) {
            this.state.gameOver = true;
            this.callbacks.onPlayerDeath();
          }
        }

        // Ranged attack
        if (c.rangedAttack && dist < 150 && dist > 40 && c.rangedCooldown <= 0) {
          const nd2 = dist || 1;
          let projSpeed = 100;
          let projType = c.rangedAttack;
          let color = '#44ff44';
          if (c.rangedAttack === 'shock') { projSpeed = 80; color = '#88aaff'; }

          this.state.projectiles.push({
            pos: { x: c.pos.x + c.width / 2, y: c.pos.y + c.height / 2 },
            vel: { x: (dx / nd2) * projSpeed, y: (dy / nd2) * projSpeed },
            width: 4, height: 4, damage: Math.floor(c.damage * 0.7),
            lifetime: 2, fromPlayer: false, type: projType,
          });
          c.rangedCooldown = 2 + Math.random();
        }
      }

      // Drag
      c.vel.x *= 1 - 3 * dt;
      c.vel.y *= 1 - 3 * dt;

      const spd = Math.sqrt(c.vel.x ** 2 + c.vel.y ** 2);
      if (spd > c.speed) {
        c.vel.x = (c.vel.x / spd) * c.speed;
        c.vel.y = (c.vel.y / spd) * c.speed;
      }

      c.pos.x += c.vel.x * dt;
      c.pos.y += c.vel.y * dt;

      // Bounds
      c.pos.x = Math.max(5, Math.min(WORLD_W - 5, c.pos.x));
      c.pos.y = Math.max(10, Math.min(WORLD_H - 20, c.pos.y));
      const ctx2 = Math.floor(Math.max(0, Math.min(c.pos.x, this.state.terrain.length - 1)));
      if (c.pos.y + c.height > this.state.terrain[ctx2]) {
        c.pos.y = this.state.terrain[ctx2] - c.height;
        c.vel.y = -Math.abs(c.vel.y) * 0.3;
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
      if (di.pos.y > this.state.terrain[tx] - 4) {
        di.pos.y = this.state.terrain[tx] - 4;
        di.vel.y = 0;
      }

      // Pickup
      const dx = p.pos.x + p.width / 2 - di.pos.x;
      const dy = p.pos.y + p.height / 2 - di.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 18) {
        this.addToInventory(di.item, di.count);
        this.callbacks.onItemPickup(di.item, di.count);
        // Pickup particles
        for (let i = 0; i < 4; i++) {
          this.state.particles.push({
            pos: { ...di.pos },
            vel: { x: (Math.random() - 0.5) * 40, y: -20 - Math.random() * 20 },
            lifetime: 0.5, maxLifetime: 0.5, size: 2,
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
    // Try to stack first
    if (item.stackable) {
      for (const slot of p.inventory) {
        if (slot && slot.item.id === item.id && slot.count < item.maxStack) {
          const canAdd = Math.min(count, item.maxStack - slot.count);
          slot.count += canAdd;
          count -= canAdd;
          if (count <= 0) return;
        }
      }
      // Check quickslots too
      for (const slot of p.quickslots) {
        if (slot && slot.item.id === item.id && slot.count < item.maxStack) {
          const canAdd = Math.min(count, item.maxStack - slot.count);
          slot.count += canAdd;
          count -= canAdd;
          if (count <= 0) return;
        }
      }
    }
    // Find empty slot
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
      if (Math.sqrt(dx * dx + dy * dy) < ab.size + 8) {
        p.oxygen = Math.min(p.maxOxygen, p.oxygen + 15);
        ab.active = false;
        ab.respawnTimer = 20 + Math.random() * 10;
        // Bubble pop particles
        for (let i = 0; i < 6; i++) {
          this.state.particles.push({
            pos: { ...ab.pos },
            vel: { x: (Math.random() - 0.5) * 30, y: -15 - Math.random() * 15 },
            lifetime: 0.6, maxLifetime: 0.6, size: 2 + Math.random() * 2,
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
      return p.lifetime > 0;
    });
  }

  spawnAmbientParticles(dt: number) {
    // Ambient bubbles
    if (Math.random() < 2 * dt) {
      const x = this.state.camera.x + Math.random() * GAME_W;
      const tx = Math.floor(Math.max(0, Math.min(x, this.state.terrain.length - 1)));
      this.state.particles.push({
        pos: { x, y: this.state.terrain[tx] - Math.random() * 5 },
        vel: { x: (Math.random() - 0.5) * 5, y: -8 - Math.random() * 12 },
        lifetime: 3 + Math.random() * 3, maxLifetime: 6, size: 1 + Math.random() * 2,
        color: 'rgba(100, 200, 255, 0.3)', type: 'bubble',
      });
    }
    // Bioluminescent specks
    if (Math.random() < 1 * dt) {
      this.state.particles.push({
        pos: {
          x: this.state.camera.x + Math.random() * GAME_W,
          y: this.state.camera.y + Math.random() * GAME_H,
        },
        vel: { x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 3 },
        lifetime: 2 + Math.random() * 3, maxLifetime: 5, size: 1,
        color: Math.random() > 0.5 ? '#44ffaa' : '#44aaff', type: 'glow',
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

  spawnDamageParticles(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
      this.state.particles.push({
        pos: { x: x + Math.random() * 8, y: y + Math.random() * 8 },
        vel: { x: (Math.random() - 0.5) * 50, y: (Math.random() - 0.5) * 50 },
        lifetime: 0.4, maxLifetime: 0.4, size: 2, color: '#ff4444', type: 'damage',
      });
    }
  }

  // ================ RENDERING ================

  render() {
    const ctx = this.ctx;
    const cam = this.state.camera;
    ctx.imageSmoothingEnabled = false;

    this.renderBackground(ctx, cam);
    this.renderTerrain(ctx, cam);
    this.renderKelp(ctx, cam);
    this.renderRocks(ctx, cam);
    this.renderAirBubbles(ctx, cam);
    this.renderDroppedItems(ctx, cam);
    this.renderCreatures(ctx, cam);
    this.renderPlayer(ctx, cam);
    this.renderProjectiles(ctx, cam);
    this.renderParticles(ctx, cam);
    this.renderLightRays(ctx, cam);
    this.renderVignette(ctx);
  }

  renderBackground(ctx: CanvasRenderingContext2D, cam: Vec2) {
    // Deep ocean gradient
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_H);
    const depthFactor = cam.y / WORLD_H;
    const r = Math.floor(5 - depthFactor * 3);
    const g = Math.floor(25 - depthFactor * 15);
    const b = Math.floor(45 - depthFactor * 20);
    grad.addColorStop(0, `rgb(${r + 5}, ${g + 10}, ${b + 15})`);
    grad.addColorStop(1, `rgb(${r}, ${g}, ${b})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Parallax bg layers (distant terrain)
    ctx.fillStyle = 'rgba(10, 20, 40, 0.5)';
    for (let x = 0; x < GAME_W; x += 2) {
      const wx = x + cam.x * 0.3;
      const h = 30 + Math.sin(wx * 0.005) * 15 + Math.sin(wx * 0.015) * 8;
      ctx.fillRect(x, GAME_H - h, 2, h);
    }
    ctx.fillStyle = 'rgba(8, 15, 35, 0.6)';
    for (let x = 0; x < GAME_W; x += 2) {
      const wx = x + cam.x * 0.5;
      const h = 50 + Math.sin(wx * 0.008) * 20 + Math.sin(wx * 0.02) * 12;
      ctx.fillRect(x, GAME_H - h, 2, h);
    }
  }

  renderTerrain(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const startX = Math.floor(cam.x);
    const endX = Math.min(startX + GAME_W + 1, this.state.terrain.length);

    ctx.fillStyle = '#0a1520';
    ctx.beginPath();
    ctx.moveTo(0, GAME_H);
    for (let x = startX; x < endX; x++) {
      ctx.lineTo(x - cam.x, this.state.terrain[x] - cam.y);
    }
    ctx.lineTo(endX - cam.x, GAME_H);
    ctx.closePath();
    ctx.fill();

    // Surface detail
    ctx.fillStyle = '#142030';
    for (let x = startX; x < endX; x += 2) {
      const ty = this.state.terrain[x] - cam.y;
      ctx.fillRect(x - cam.x, ty, 2, 3);
    }
  }

  renderKelp(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const k of this.state.kelp) {
      const sx = k.x - cam.x;
      if (sx < -10 || sx > GAME_W + 10) continue;
      const baseY = this.state.terrain[Math.min(Math.floor(k.x), this.state.terrain.length - 1)] - cam.y;
      const sway = Math.sin(this.state.time * 1.5 + k.phase) * 4;

      ctx.fillStyle = '#1a4a2a';
      for (let i = 0; i < k.height; i += 3) {
        const swayAmt = (i / k.height) * sway;
        ctx.fillRect(sx + swayAmt, baseY - i - 3, 2, 3);
      }
      // Glowing tip
      const tipSway = sway * 1;
      ctx.fillStyle = `rgba(60, 255, 120, ${0.3 + Math.sin(this.state.time * 2 + k.phase) * 0.2})`;
      ctx.fillRect(sx + tipSway - 1, baseY - k.height - 2, 3, 3);
    }
  }

  renderRocks(ctx: CanvasRenderingContext2D, cam: Vec2) {
    ctx.fillStyle = '#1a2535';
    for (const r of this.state.rocks) {
      const sx = r.x - cam.x;
      if (sx < -20 || sx > GAME_W + 20) continue;
      ctx.fillRect(sx - r.size / 2, r.y - cam.y - r.size, r.size, r.size);
    }
  }

  renderAirBubbles(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const ab of this.state.airBubbles) {
      if (!ab.active) continue;
      const sx = ab.pos.x - cam.x;
      const sy = ab.pos.y - cam.y;
      if (sx < -10 || sx > GAME_W + 10) continue;

      const pulse = 1 + Math.sin(this.state.time * 3) * 0.15;
      const r = ab.size * pulse;
      ctx.strokeStyle = 'rgba(100, 220, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(100, 220, 255, 0.15)';
      ctx.fill();

      // Glow
      ctx.fillStyle = 'rgba(100, 220, 255, 0.08)';
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderDroppedItems(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const di of this.state.droppedItems) {
      const sx = di.pos.x - cam.x;
      const sy = di.pos.y - cam.y + Math.sin(this.state.time * 3 + di.bobOffset) * 2;
      if (sx < -10 || sx > GAME_W + 10) continue;

      const color = RARITY_COLORS[di.item.rarity];

      // Glow
      ctx.fillStyle = color + '33';
      ctx.fillRect(sx - 4, sy - 4, 8, 8);

      // Item dot
      ctx.fillStyle = color;
      ctx.fillRect(sx - 2, sy - 2, 4, 4);

      // Sparkle
      if (di.item.rarity !== 'common') {
        const sparkle = Math.sin(this.state.time * 5 + di.bobOffset) > 0.5;
        if (sparkle) {
          ctx.fillStyle = color + 'aa';
          ctx.fillRect(sx - 1, sy - 5, 1, 2);
          ctx.fillRect(sx + 2, sy - 3, 2, 1);
        }
      }
    }
  }

  renderCreatures(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const c of this.state.creatures) {
      if (c.state === 'dead') continue;
      const sx = c.pos.x - cam.x;
      const sy = c.pos.y - cam.y;
      if (sx < -30 || sx > GAME_W + 30) continue;

      ctx.save();
      ctx.translate(sx + c.width / 2, sy + c.height / 2);
      if (c.facing < 0) ctx.scale(-1, 1);

      this.drawCreatureSprite(ctx, c);

      ctx.restore();

      // HP bar
      if (c.hp < c.maxHp) {
        const barW = c.width;
        const hpPct = c.hp / c.maxHp;
        ctx.fillStyle = '#331111';
        ctx.fillRect(sx, sy - 4, barW, 2);
        ctx.fillStyle = hpPct > 0.5 ? '#44cc44' : hpPct > 0.25 ? '#ccaa22' : '#cc2222';
        ctx.fillRect(sx, sy - 4, barW * hpPct, 2);
      }
    }
  }

  drawCreatureSprite(ctx: CanvasRenderingContext2D, c: Creature) {
    const w = c.width / 2;
    const h = c.height / 2;
    const bob = Math.sin(this.state.time * 3 + c.pos.x) * 1;

    switch (c.spriteType) {
      case 'fish':
        ctx.fillStyle = '#884466';
        ctx.fillRect(-w, -h + bob, w * 2 - 3, h * 2);
        ctx.fillStyle = '#aa5577';
        ctx.fillRect(-w + 2, -h + 2 + bob, w * 2 - 6, h * 2 - 4);
        // Tail
        ctx.fillStyle = '#773355';
        ctx.fillRect(-w - 3, -h + 1 + bob, 3, h * 2 - 2);
        // Eye
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(w - 4, -h + 2 + bob, 2, 2);
        break;

      case 'eel':
        ctx.fillStyle = '#446644';
        for (let i = 0; i < 4; i++) {
          const segBob = Math.sin(this.state.time * 4 + i * 0.8) * 2;
          ctx.fillRect(-w + i * 5, -h + segBob, 5, h * 2);
        }
        ctx.fillStyle = '#66ff44';
        ctx.fillRect(w - 3, -h + 1, 2, 2);
        break;

      case 'jelly':
        const jBob = Math.sin(this.state.time * 2) * 2;
        ctx.fillStyle = 'rgba(100, 150, 255, 0.6)';
        ctx.fillRect(-w + 1, -h + jBob, w * 2 - 2, h);
        // Tentacles
        ctx.fillStyle = 'rgba(80, 130, 255, 0.4)';
        for (let i = 0; i < 3; i++) {
          const tBob = Math.sin(this.state.time * 3 + i) * 2;
          ctx.fillRect(-w + 2 + i * 4, h * 0.5 + jBob, 1, 4 + tBob);
        }
        // Glow
        ctx.fillStyle = 'rgba(120, 180, 255, 0.15)';
        ctx.fillRect(-w - 2, -h - 2 + jBob, w * 2 + 4, h * 2 + 4);
        break;

      case 'crab':
        ctx.fillStyle = '#885533';
        ctx.fillRect(-w + 2, -h + 2 + bob, w * 2 - 4, h * 2 - 2);
        // Claws
        ctx.fillStyle = '#aa6644';
        ctx.fillRect(-w - 2, -h + 3 + bob, 3, 4);
        ctx.fillRect(w - 1, -h + 3 + bob, 3, 4);
        // Eyes
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(-w + 4, -h + bob, 2, 2);
        ctx.fillRect(w - 6, -h + bob, 2, 2);
        break;
    }
  }

  renderPlayer(ctx: CanvasRenderingContext2D, cam: Vec2) {
    const p = this.state.player;
    const sx = p.pos.x - cam.x;
    const sy = p.pos.y - cam.y;

    // Flash when invincible
    if (p.invincible > 0 && Math.sin(this.state.time * 20) > 0) return;

    ctx.save();
    ctx.translate(sx + p.width / 2, sy + p.height / 2);
    if (p.facing < 0) ctx.scale(-1, 1);

    // Legs
    const legBob = Math.sin(this.state.time * 8) * 1;
    ctx.fillStyle = '#334455';
    ctx.fillRect(-3, 5, 2, 4 + legBob);
    ctx.fillRect(1, 5, 2, 4 - legBob);

    // Body/suit
    ctx.fillStyle = '#2a3a4a';
    ctx.fillRect(-4, -4, 8, 10);

    // Tank on back
    ctx.fillStyle = '#556677';
    ctx.fillRect(-5, -2, 2, 6);

    // Helmet
    ctx.fillStyle = '#667788';
    ctx.fillRect(-3, -8, 6, 5);

    // Visor
    ctx.fillStyle = '#88ccff';
    ctx.fillRect(-1, -7, 3, 3);
    // Visor glow
    ctx.fillStyle = 'rgba(136, 204, 255, 0.15)';
    ctx.fillRect(-3, -9, 8, 6);

    // Arm / Harpoon
    ctx.fillStyle = '#3a4a5a';
    ctx.fillRect(3, -1, 3, 2);
    ctx.fillStyle = '#8a7a6a';
    ctx.fillRect(5, -1, 4, 1);

    ctx.restore();

    // Swim bubbles
    if (Math.abs(p.vel.x) > 10 || Math.abs(p.vel.y) > 10) {
      if (Math.random() < 0.3) {
        this.state.particles.push({
          pos: { x: p.pos.x - p.facing * 5, y: p.pos.y + 2 },
          vel: { x: -p.facing * 5, y: -5 },
          lifetime: 0.8, maxLifetime: 0.8, size: 1 + Math.random(),
          color: 'rgba(150, 220, 255, 0.4)', type: 'bubble',
        });
      }
    }
  }

  renderProjectiles(ctx: CanvasRenderingContext2D, cam: Vec2) {
    for (const proj of this.state.projectiles) {
      const sx = proj.pos.x - cam.x;
      const sy = proj.pos.y - cam.y;

      if (proj.fromPlayer) {
        ctx.fillStyle = '#aaddff';
        ctx.fillRect(sx - 1, sy - 1, 3, 2);
        ctx.fillStyle = 'rgba(150, 220, 255, 0.3)';
        ctx.fillRect(sx - 2, sy - 2, 5, 4);
      } else {
        const color = proj.type === 'acid' ? '#44ff44' : '#8888ff';
        ctx.fillStyle = color;
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
        ctx.fillStyle = color + '44';
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
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
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  renderLightRays(ctx: CanvasRenderingContext2D, cam: Vec2) {
    if (cam.y > 200) return; // No light in deep areas
    const alpha = Math.max(0, 0.08 - cam.y * 0.0003);
    ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
    for (let i = 0; i < 5; i++) {
      const x = (i * 120 + this.state.time * 5) % (GAME_W + 40) - 20;
      const w = 8 + Math.sin(this.state.time * 0.5 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 15, GAME_H);
      ctx.lineTo(x - 15 + w, GAME_H);
      ctx.lineTo(x + w, 0);
      ctx.closePath();
      ctx.fill();
    }
  }

  renderVignette(ctx: CanvasRenderingContext2D) {
    const grad = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.4, GAME_W / 2, GAME_H / 2, GAME_H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
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
}
