import { useEffect, useRef, useState } from "react";

// ---------- Palette (monochrome crimson) ----------
const C = {
  bg0: "#1a0206",
  bg1: "#2a0409",
  bg2: "#3d060d",
  bg3: "#5a0912",
  mid: "#7a0d19",
  hi: "#a81524",
  bright: "#d92036",
  pale: "#f26478",
  sun: "#ff8090",
  text: "#f6c4ca",
  cream: "#fff4dc",
  creamShade: "#e8cf9f",
  creamDark: "#a88a55",
};

// ---------- Types ----------
type Rect = { x: number; y: number; w: number; h: number };
type Platform = Rect & {
  id: number;
  vanishOnTouch?: boolean;
  vanishDelay?: number; // ms after touch
  triggerX?: number; // vanish/appear when player passes this x
  appearAt?: number; // becomes solid at this time
  fallOnTouch?: boolean;
  falling?: boolean;
  fallStart?: number;
  gone?: boolean;
  driftFrom?: number; // start x
  driftTo?: number;
  driftSpeed?: number;
  driftDir?: 1 | -1;
  push?: number; // horizontal push force applied when standing on
};
type Spike = Rect & {
  id: number;
  triggerX?: number; // emerges when player passes x
  emerging?: boolean;
  emergeStart?: number;
  active?: boolean;
};
type Fountain = {
  id: number;
  x: number;
  nextAt: number;
  interval: number;
  height: number;
  active: boolean;
  startedAt: number;
};

// ---------- Level ----------
const LEVEL_W = 4200;
const LEVEL_H = 540;
const GROUND_Y = 460;
const START = { x: 60, y: GROUND_Y - 30 };
const DOOR: Rect = { x: LEVEL_W - 120, y: GROUND_Y - 60, w: 34, h: 60 };

// Blood level rises as player progresses (segments)
// bloodY(x) returns the y where blood surface is (lower y = higher).
function bloodY(x: number): number {
  // river to the right of x=800 rises gradually; certain zones flood
  if (x < 700) return GROUND_Y + 200; // dry
  if (x < 1400) return GROUND_Y + 40; // shallow river below ground gap
  if (x < 2200) return GROUND_Y + 10;
  if (x < 3000) return GROUND_Y - 10; // flooding
  return GROUND_Y - 20;
}

// Ground segments (holes over blood river)
const GROUND_SEGMENTS: Rect[] = [
  { x: 0, y: GROUND_Y, w: 720, h: 80 },
  { x: 820, y: GROUND_Y, w: 220, h: 80 },
  { x: 1180, y: GROUND_Y, w: 180, h: 80 },
  // gap where blood is high — must use floating platforms
  { x: 1900, y: GROUND_Y, w: 140, h: 80 },
  { x: 2260, y: GROUND_Y, w: 160, h: 80 },
  { x: 2560, y: GROUND_Y, w: 180, h: 80 },
  { x: 2900, y: GROUND_Y, w: 220, h: 80 },
  { x: 3260, y: GROUND_Y, w: 300, h: 80 },
  { x: 3700, y: GROUND_Y, w: 500, h: 80 },
];

function makeLevel(): { platforms: Platform[]; spikes: Spike[]; fountains: Fountain[] } {
  let pid = 0;
  const p = (o: Omit<Platform, "id">): Platform => ({ id: pid++, ...o });
  let sid = 0;
  const s = (o: Omit<Spike, "id">): Spike => ({ id: sid++, ...o });

  const platforms: Platform[] = [
    // Sec 1: teach jump
    p({ x: 380, y: GROUND_Y - 70, w: 90, h: 14 }),
    p({ x: 520, y: GROUND_Y - 110, w: 90, h: 14 }),
    // Sec 2: fake safe — vanishes when landed on
    p({ x: 760, y: GROUND_Y - 60, w: 70, h: 14, vanishOnTouch: true, vanishDelay: 250 }),
    // Sec 3: gap crossing with drifting platform
    p({ x: 1060, y: GROUND_Y - 40, w: 90, h: 14 }),
    p({
      x: 1150,
      y: GROUND_Y - 70,
      w: 80,
      h: 14,
      driftFrom: 1150,
      driftTo: 1360,
      driftSpeed: 60,
      driftDir: 1,
    }),
    // Sec 4: collapsing bridge
    p({ x: 1360, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1400, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1440, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1480, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1520, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1560, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1600, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1640, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1680, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1720, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1760, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1800, y: GROUND_Y - 30, w: 40, h: 14, fallOnTouch: true }),
    p({ x: 1840, y: GROUND_Y - 30, w: 60, h: 14 }), // safe landing
    // Sec 5: current pushes right (over ground)
    p({ x: 2040, y: GROUND_Y - 80, w: 220, h: 14, push: 90 }),
    // Sec 6: drifting islands over blood
    p({
      x: 2420,
      y: GROUND_Y - 50,
      w: 90,
      h: 14,
      driftFrom: 2420,
      driftTo: 2500,
      driftSpeed: 40,
      driftDir: 1,
    }),
    // Sec 7: vanish-on-approach chain (trigger)
    p({ x: 2750, y: GROUND_Y - 60, w: 60, h: 14, triggerX: 2700, vanishOnTouch: true, vanishDelay: 400 }),
    p({ x: 2820, y: GROUND_Y - 100, w: 60, h: 14 }),
    // Sec 8: high road with hidden spikes emerging + fountains
    p({ x: 3120, y: GROUND_Y - 120, w: 120, h: 14 }),
    p({ x: 3280, y: GROUND_Y - 120, w: 120, h: 14 }),
    // Sec 9: last stretch — a platform that appears when triggered (mercy)
    p({ x: 3620, y: GROUND_Y - 70, w: 60, h: 14 }),
  ];

  const spikes: Spike[] = [
    // Emerging spikes when passing certain x — "safe becomes dangerous"
    s({ x: 640, y: GROUND_Y - 16, w: 60, h: 16, triggerX: 600, active: false }),
    s({ x: 1220, y: GROUND_Y - 16, w: 50, h: 16, triggerX: 1200, active: false }),
    s({ x: 2320, y: GROUND_Y - 16, w: 50, h: 16, triggerX: 2280, active: false }),
    s({ x: 2620, y: GROUND_Y - 16, w: 60, h: 16, triggerX: 2600, active: false }),
    s({ x: 3320, y: GROUND_Y - 16, w: 80, h: 16, triggerX: 3300, active: false }),
  ];

  const fountains: Fountain[] = [
    { id: 0, x: 3180, nextAt: 0, interval: 1600, height: 140, active: false, startedAt: 0 },
    { id: 1, x: 3360, nextAt: 800, interval: 1600, height: 140, active: false, startedAt: 0 },
  ];

  return { platforms, spikes, fountains };
}

// ---------- Audio (WebAudio synths) ----------
class GameAudio {
  ctx: AudioContext | null = null;
  ambient: OscillatorNode | null = null;
  ambientGain: GainNode | null = null;
  ensure() {
    if (!this.ctx) {
      const AC =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    return this.ctx;
  }
  jump() {
    const c = this.ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(520, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.09);
    g.gain.setValueAtTime(0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.13);
  }
  death() {
    const c = this.ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(300, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.35);
    g.gain.setValueAtTime(0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.42);
  }
  startAmbient() {
    const c = this.ensure();
    if (!c || this.ambient) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = 78;
    g.gain.value = 0.025;
    const lfo = c.createOscillator();
    const lfoG = c.createGain();
    lfo.frequency.value = 0.15;
    lfoG.gain.value = 6;
    lfo.connect(lfoG).connect(o.frequency);
    o.connect(g).connect(c.destination);
    o.start();
    lfo.start();
    this.ambient = o;
    this.ambientGain = g;
  }
}

// ---------- Component ----------
export function PlagueOne() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ended, setEnded] = useState<null | "pharaoh" | "cont">(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !started) return;
    const ctx = canvas.getContext("2d")!;
    const audio = new GameAudio();
    audio.startAmbient();

    // Logical resolution (pixel art). We scale to fit.
    const VW = 480;
    const VH = 270;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let last = performance.now();
    const keys = new Set<string>();

    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.add(k);
      if (k === " " || k === "arrowup" || k === "w") e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    let deaths = 0;
    let reached = false;
    let reachedAt = 0;

    // World state (reset on death)
    let world = makeLevel();
    const player = {
      x: START.x,
      y: START.y,
      vx: 0,
      vy: 0,
      w: 10,
      h: 14,
      onGround: false,
      face: 1,
      walkT: 0,
    };
    let camX = 0;
    let timeAlive = 0;

    const respawn = () => {
      world = makeLevel();
      player.x = START.x;
      player.y = START.y;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
      timeAlive = 0;
      deaths++;
    };

    const die = () => {
      audio.death();
      respawn();
    };

    const rectsOverlap = (a: Rect, b: Rect) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    const step = (dt: number, now: number) => {
      if (reached) return;
      timeAlive += dt;

      // Input
      const left = keys.has("arrowleft") || keys.has("a");
      const right = keys.has("arrowright") || keys.has("d");
      const jump = keys.has(" ") || keys.has("arrowup") || keys.has("w");

      const accel = 900;
      const maxSpd = 130;
      const friction = 800;
      if (left) {
        player.vx -= accel * dt;
        player.face = -1;
      }
      if (right) {
        player.vx += accel * dt;
        player.face = 1;
      }
      if (!left && !right) {
        const s = Math.sign(player.vx);
        player.vx -= s * Math.min(Math.abs(player.vx), friction * dt);
      }
      player.vx = Math.max(-maxSpd, Math.min(maxSpd, player.vx));

      if (jump && player.onGround) {
        player.vy = -270;
        player.onGround = false;
        audio.jump();
      }

      // Gravity
      player.vy += 780 * dt;
      if (player.vy > 520) player.vy = 520;

      // Triggers: spikes emerge when player passes x
      for (const sp of world.spikes) {
        if (!sp.active && sp.triggerX !== undefined && player.x + player.w / 2 > sp.triggerX) {
          sp.active = true;
          sp.emerging = true;
          sp.emergeStart = now;
        }
      }
      // Platform triggers (vanish on approach etc handled via touch)

      // Drift platforms
      for (const pl of world.platforms) {
        if (pl.driftFrom !== undefined && pl.driftTo !== undefined && pl.driftSpeed && !pl.gone) {
          pl.x += (pl.driftDir ?? 1) * pl.driftSpeed * dt;
          if (pl.x <= pl.driftFrom) {
            pl.x = pl.driftFrom;
            pl.driftDir = 1;
          } else if (pl.x >= pl.driftTo) {
            pl.x = pl.driftTo;
            pl.driftDir = -1;
          }
        }
        if (pl.falling && !pl.gone) {
          pl.y += 300 * dt;
          if (pl.y > LEVEL_H + 100) pl.gone = true;
        }
        if (pl.vanishOnTouch && pl.fallStart && !pl.gone && now - pl.fallStart > (pl.vanishDelay ?? 200)) {
          pl.gone = true;
        }
      }

      // Fountains
      for (const f of world.fountains) {
        if (!f.active && now >= f.nextAt) {
          f.active = true;
          f.startedAt = now;
        }
        if (f.active && now - f.startedAt > 700) {
          f.active = false;
          f.nextAt = now + f.interval;
        }
      }

      // Move X
      player.x += player.vx * dt;
      // Horizontal collision with ground segments & platforms
      const solids: Rect[] = [
        ...GROUND_SEGMENTS,
        ...world.platforms.filter((p) => !p.gone && !p.falling),
      ];
      for (const r of solids) {
        if (rectsOverlap(player, r)) {
          if (player.vx > 0) player.x = r.x - player.w;
          else if (player.vx < 0) player.x = r.x + r.w;
          player.vx = 0;
        }
      }

      // Move Y
      player.y += player.vy * dt;
      player.onGround = false;
      let standingOn: Platform | null = null;
      for (const r of solids) {
        if (rectsOverlap(player, r)) {
          if (player.vy > 0) {
            player.y = r.y - player.h;
            player.vy = 0;
            player.onGround = true;
            const pl = world.platforms.find((p) => p === r);
            if (pl) standingOn = pl;
          } else if (player.vy < 0) {
            player.y = r.y + r.h;
            player.vy = 0;
          }
        }
      }

      // Standing-on effects
      if (standingOn) {
        if (standingOn.push) player.x += standingOn.push * dt;
        if (standingOn.vanishOnTouch && !standingOn.fallStart) standingOn.fallStart = now;
        if (standingOn.fallOnTouch && !standingOn.falling) {
          standingOn.falling = true;
          standingOn.fallStart = now;
        }
      }

      // Bounds
      if (player.x < 0) {
        player.x = 0;
        player.vx = 0;
      }
      if (player.x + player.w > LEVEL_W) player.x = LEVEL_W - player.w;

      // Death: fall into blood
      const bY = bloodY(player.x + player.w / 2);
      if (player.y + player.h > bY) {
        die();
        return;
      }

      // Death: spikes
      for (const sp of world.spikes) {
        if (!sp.active) continue;
        const grow = sp.emergeStart ? Math.min(1, (now - sp.emergeStart) / 180) : 1;
        const rect = { x: sp.x, y: sp.y + (1 - grow) * sp.h, w: sp.w, h: sp.h * grow };
        if (rectsOverlap(player, rect)) {
          die();
          return;
        }
      }

      // Death: fountains
      for (const f of world.fountains) {
        if (!f.active) continue;
        const rect = { x: f.x - 4, y: GROUND_Y - f.height, w: 8, h: f.height };
        if (rectsOverlap(player, rect)) {
          die();
          return;
        }
      }

      // Reached door
      if (rectsOverlap(player, DOOR)) {
        reached = true;
        reachedAt = now;
        setEnded("pharaoh");
        setTimeout(() => setEnded("cont"), 2600);
      }

      // Camera
      const targetCam = Math.max(0, Math.min(LEVEL_W - VW, player.x + player.w / 2 - VW / 2));
      camX += (targetCam - camX) * Math.min(1, dt * 6);

      player.walkT += Math.abs(player.vx) * dt * 0.05;
    };

    const drawBg = () => {
      // sky
      ctx.fillStyle = C.bg0;
      ctx.fillRect(0, 0, VW, VH);
      // sun (large)
      const sunX = 360 - camX * 0.15;
      const sunY = 60;
      ctx.fillStyle = C.sun;
      for (let r = 34; r > 0; r -= 2) {
        ctx.fillStyle = r > 28 ? C.bg2 : r > 22 ? C.bg3 : r > 16 ? C.mid : r > 10 ? C.hi : r > 5 ? C.bright : C.sun;
        ctx.beginPath();
        ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // pyramids
      const px = -camX * 0.35;
      const pyramid = (baseX: number, baseY: number, size: number, col: string) => {
        ctx.fillStyle = col;
        for (let i = 0; i < size; i++) {
          ctx.fillRect(baseX + i, baseY - i, size * 2 - i * 2, 1);
        }
      };
      pyramid(60 + px, 200, 60, C.bg2);
      pyramid(180 + px, 200, 80, C.bg1);
      pyramid(320 + px, 200, 50, C.bg2);
      pyramid(480 + px, 200, 70, C.bg1);
      pyramid(680 + px, 200, 55, C.bg2);
      pyramid(880 + px, 200, 90, C.bg1);
      pyramid(1120 + px, 200, 60, C.bg2);

      // palm trees (simple)
      const drawPalm = (x: number, y: number) => {
        ctx.fillStyle = C.bg3;
        ctx.fillRect(x, y - 22, 2, 22);
        ctx.fillStyle = C.mid;
        ctx.fillRect(x - 6, y - 24, 14, 2);
        ctx.fillRect(x - 4, y - 26, 10, 2);
      };
      const tx = -camX * 0.6;
      drawPalm(120 + tx, 210);
      drawPalm(260 + tx, 210);
      drawPalm(430 + tx, 210);
      drawPalm(590 + tx, 210);
      drawPalm(760 + tx, 210);
      drawPalm(940 + tx, 210);
    };

    const worldToScreen = (x: number, y: number) => ({ x: x - camX, y: y });

    const draw = () => {
      // Scale from logical VW×VH to canvas size
      const scale = Math.min(canvas.width / VW, canvas.height / VH);
      const ox = (canvas.width - VW * scale) / 2;
      const oy = (canvas.height - VH * scale) / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, ox, oy);

      drawBg();

      // Blood river (draw across screen)
      // Sample blood surface across visible x range
      ctx.fillStyle = C.bg3;
      for (let sx = 0; sx < VW; sx++) {
        const wx = sx + camX;
        const by = bloodY(wx) - 0; // world y
        // wave shimmer
        const wave = Math.sin(wx * 0.05 + performance.now() * 0.002) * 1.2;
        ctx.fillRect(sx, by + wave, 1, VH - by);
      }
      ctx.fillStyle = C.hi;
      for (let sx = 0; sx < VW; sx += 2) {
        const wx = sx + camX;
        const by = bloodY(wx) + Math.sin(wx * 0.05 + performance.now() * 0.002) * 1.2;
        ctx.fillRect(sx, by, 2, 1);
      }

      // Ground
      ctx.fillStyle = C.bg2;
      for (const g of GROUND_SEGMENTS) {
        const s = worldToScreen(g.x, g.y);
        ctx.fillRect(s.x, s.y, g.w, g.h);
        ctx.fillStyle = C.bg3;
        ctx.fillRect(s.x, s.y, g.w, 2);
        ctx.fillStyle = C.bg2;
      }

      // Platforms
      for (const p of world.platforms) {
        if (p.gone) continue;
        const s = worldToScreen(p.x, p.y);
        ctx.fillStyle = p.push ? C.hi : p.fallOnTouch ? C.mid : p.vanishOnTouch ? C.bg3 : C.mid;
        ctx.fillRect(s.x, s.y, p.w, p.h);
        ctx.fillStyle = C.bright;
        ctx.fillRect(s.x, s.y, p.w, 1);
        if (p.push) {
          // arrow markers indicating current
          ctx.fillStyle = C.pale;
          for (let i = 0; i < p.w; i += 12) {
            const t = ((performance.now() * 0.05) % 12) + i;
            ctx.fillRect(s.x + (t % p.w), s.y + 5, 3, 2);
          }
        }
      }

      // Spikes
      for (const sp of world.spikes) {
        if (!sp.active) continue;
        const grow = sp.emergeStart ? Math.min(1, (performance.now() - sp.emergeStart) / 180) : 1;
        const s = worldToScreen(sp.x, sp.y + (1 - grow) * sp.h);
        const h = sp.h * grow;
        ctx.fillStyle = C.bright;
        const teeth = Math.max(1, Math.floor(sp.w / 6));
        for (let i = 0; i < teeth; i++) {
          const tx = s.x + i * (sp.w / teeth);
          ctx.beginPath();
          ctx.moveTo(tx, s.y + h);
          ctx.lineTo(tx + sp.w / teeth / 2, s.y);
          ctx.lineTo(tx + sp.w / teeth, s.y + h);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Fountains
      for (const f of world.fountains) {
        if (!f.active) continue;
        const s = worldToScreen(f.x, GROUND_Y - f.height);
        ctx.fillStyle = C.bright;
        ctx.fillRect(s.x - 2, s.y, 4, f.height);
        ctx.fillStyle = C.pale;
        ctx.fillRect(s.x - 1, s.y, 2, f.height);
      }

      // Door (exit) — Pharaoh's chamber
      const ds = worldToScreen(DOOR.x, DOOR.y);
      ctx.fillStyle = C.bg3;
      ctx.fillRect(ds.x - 6, ds.y - 6, DOOR.w + 12, DOOR.h + 6);
      ctx.fillStyle = C.mid;
      ctx.fillRect(ds.x, ds.y, DOOR.w, DOOR.h);
      ctx.fillStyle = C.hi;
      ctx.fillRect(ds.x + 2, ds.y + 2, DOOR.w - 4, DOOR.h - 4);
      ctx.fillStyle = C.bright;
      ctx.fillRect(ds.x + DOOR.w / 2 - 2, ds.y + DOOR.h / 2, 4, 4);

      // Moses (tiny pixel man)
      const ps = worldToScreen(player.x, player.y);
      const walk = Math.floor(player.walkT) % 2 === 0;
      // robe
      ctx.fillStyle = C.bright;
      ctx.fillRect(ps.x, ps.y + 6, player.w, player.h - 6);
      // head
      ctx.fillStyle = C.pale;
      ctx.fillRect(ps.x + 2, ps.y, player.w - 4, 6);
      // beard
      ctx.fillStyle = C.hi;
      ctx.fillRect(ps.x + 2, ps.y + 5, player.w - 4, 2);
      // staff
      ctx.fillStyle = C.pale;
      const staffX = player.face === 1 ? ps.x + player.w : ps.x - 1;
      ctx.fillRect(staffX, ps.y - 3, 1, player.h + 3);
      // legs
      ctx.fillStyle = C.hi;
      if (player.onGround) {
        ctx.fillRect(ps.x + 2, ps.y + player.h - 2, 2, 2);
        ctx.fillRect(ps.x + player.w - 4, ps.y + player.h - 2, 2, 2);
        if (walk && Math.abs(player.vx) > 5) {
          ctx.fillRect(ps.x + 1, ps.y + player.h - 1, 2, 1);
        }
      }

      // HUD
      ctx.fillStyle = C.text;
      ctx.font = "8px monospace";
      ctx.fillText("PLAGUE I — WATER TURNED TO BLOOD", 8, 12);
      ctx.fillText("DEATHS " + deaths, 8, 22);
      ctx.fillText("← → / A D    SPACE JUMP", VW - 130, 12);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      step(dt, now);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Resize
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.imageSmoothingEnabled = false;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      ro.disconnect();
    };
    // We intentionally only re-run when `started` toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center"
      style={{ background: C.bg0 }}
    >
      <div className="flex w-full max-w-[1100px] flex-col items-center gap-3 p-4">
        <div className="w-full text-center">
          <h1 className="text-sm tracking-[0.4em]" style={{ color: C.pale, fontFamily: "monospace" }}>
            MOSES — THE TEN PLAGUES
          </h1>
          <p className="mt-1 text-xs tracking-widest" style={{ color: C.text, fontFamily: "monospace" }}>
            PLAGUE I · WATER TURNED TO BLOOD
          </p>
        </div>
        <div
          className="relative aspect-[16/9] w-full overflow-hidden rounded-sm"
          style={{ border: `2px solid ${C.bg3}`, background: "#000" }}
        >
          <canvas
            ref={canvasRef}
            className="h-full w-full"
            style={{ imageRendering: "pixelated", display: "block" }}
          />
          {!started && (
            <button
              onClick={() => setStarted(true)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background: "rgba(10,1,3,0.85)", color: C.pale, fontFamily: "monospace" }}
            >
              <span className="text-xs tracking-[0.4em]">PLAGUE I</span>
              <span className="text-2xl tracking-widest">WATER TURNED TO BLOOD</span>
              <span className="mt-6 text-xs tracking-widest" style={{ color: C.text }}>
                ▶ PRESS TO BEGIN
              </span>
              <span className="mt-1 text-[10px] tracking-widest" style={{ color: C.mid }}>
                ← → / A D · SPACE
              </span>
            </button>
          )}
          {ended && (
            <EndOverlay stage={ended} />
          )}
        </div>
        <p className="text-[10px] tracking-widest" style={{ color: C.mid, fontFamily: "monospace" }}>
          THE ENVIRONMENT IS THE ENEMY
        </p>
      </div>
    </div>
  );
}

function EndOverlay({ stage }: { stage: "pharaoh" | "cont" }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-4"
      style={{
        background: stage === "pharaoh" ? "rgba(10,1,3,0.7)" : "#000",
        color: C.pale,
        fontFamily: "monospace",
        transition: "background 1.2s ease",
      }}
    >
      {stage === "pharaoh" ? (
        <>
          <div className="text-[10px] tracking-[0.4em]" style={{ color: C.text }}>
            PHARAOH
          </div>
          <div className="text-6xl tracking-widest">"No."</div>
        </>
      ) : (
        <>
          <div className="text-lg tracking-widest">The first plague was not enough.</div>
          <div className="mt-8 text-xs tracking-[0.4em]" style={{ color: C.mid }}>
            TO BE CONTINUED…
          </div>
        </>
      )}
    </div>
  );
}
