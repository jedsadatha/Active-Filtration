// ── config ────────────────────────────────────────────────────────
const POLLEN_COUNT   = 4000;
const ATTRACT_RADIUS = 240;
const FACE_SPREAD    = 110;   // half-size of face scatter zone
const ATTRACT_FORCE  = 2.8;
const STICK_FORCE    = 4.5;   // spring toward assigned face position
const FRICTION       = 0.82;
const CONFIDENCE     = 0.2;

// Fixed simulation size (canvas is CSS-scaled to fit window)
const SIM_W = 3072;
const SIM_H = 1280;

// ── wipe config ───────────────────────────────────────────────────
const WIPE_RADIUS      = 50;
const WIPE_SPEED_MIN   = 4;
const WIPE_FLING_SCALE = 0.2;

// ── wind config ───────────────────────────────────────────────────
const WIND_COLS     = 28;
const WIND_ROWS     = 18;
const WIND_SCALE    = 0.0018;
const WIND_EVOLVE   = 0.00025;
const WIND_STRENGTH = 0.55;
const GUST_INTERVAL = 280;
const GUST_DURATION = 90;
const SHOW_WIND     = true;

const WIND_DRAG = { tree: 1.0, grass: 0.65, weed: 0.35 };

const HEAD_KEYPOINTS = [0, 1, 2, 3, 4];
const HAND_KEYPOINTS = [9, 10];

let currentScale = 1.0;
let vScale = 1, vX = 0, vY = 0;

// ── label text size ───────────────────────────────────────────────
let labelTextSize = 58;
const LABEL_TEXT_SIZE_MIN  = 12;
const LABEL_TEXT_SIZE_MAX  = 120;
const LABEL_TEXT_SIZE_STEP = 4;

// ── face collection HUD ────────────────────────────────────────────
const POLLEN_THRESHOLDS = {
  tree: 90,
  grass: 20,
  weed: 50
};

const FACE_BOX_STROKE_WEIGHT = 7;
const SYMPTOM_REVEAL_INTERVAL_FRAMES = 28;
const SYMPTOM_POPIN_FRAMES = 24;

// Ordered from low severity (1st) to high severity (5th)
const POLLEN_SYMPTOMS = {
  tree: [
    'Sniffles',
    'Nasal Congestion',
    'Watery, Red Eyes',
    'Sudden Sneezing Fits',
    'Sinus Headaches',
  ],
  grass: [
    'Tickly Throat',
    'Runny Nose',
    'Oral Irritation',
    'Eye Itching',
    'Fatigue',
  ],
  weed: [
    'Throat Clearing',
    'Persistent Post-Nasal Drip',
    'Ear Pluggedness',
    'Sleep Disruption',
    'Asthmatic Triggers',
  ],
};

const SYMPTOM_SEVERITY_COLORS = [
  [230, 210, 95],  // level 1
  [238, 184, 82],  // level 2
  [242, 151, 74],  // level 3
  [233, 118, 66],  // level 4
  [217, 84, 66],   // level 5
];

// Per-face symptom state (keyed by face id)
let symptomBursts = {};

// ── zone definitions ──────────────────────────────────────────────
const ZONE_DEFS = [
  { type: 'tree',  label: 'Spring',  tint: [80, 190, 80,  120] },
  { type: 'grass', label: 'Summer',  tint: [235, 135, 35, 120] },
  { type: 'weed',  label: 'Fall',    tint: [70, 115, 255, 120] },
];

// ── pollen type definitions ───────────────────────────────────────
const POLLEN_TYPES = {
  tree: {
    baseCol: () => [random(210,240), random(220,245), random(80,140)],
    alpha:   () => random(170, 230),
    r:       () => random(3.5, 7.5),
    vy:      () => random(0.04, 0.22),
    vx:      () => random(-0.2, 0.2),
    draw(g, r, col, alpha, angle) {
      g.fill(col[0], col[1], col[2], alpha);
      g.beginShape();
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * TWO_PI + angle;
        const rad = i % 2 === 0 ? r : r * 0.55;
        g.vertex(cos(ang) * rad, sin(ang) * rad);
      }
      g.endShape(CLOSE);
      g.fill(240, 255, 160, alpha * 0.9);
      g.ellipse(0, 0, r * 0.55, r * 0.55);
    }
  },
  grass: {
    baseCol: () => [random(180,220), random(210,240), random(100,160)],
    alpha:   () => random(140, 210),
    r:       () => random(2.5, 5.5),
    vy:      () => random(0.08, 0.38),
    vx:      () => random(-0.12, 0.12),
    draw(g, r, col, alpha, angle) {
      g.fill(col[0], col[1], col[2], alpha);
      g.ellipse(0, 0, r * 0.6, r * 1.85);
      g.stroke(col[0] - 30, col[1] - 20, col[2] + 40, alpha * 0.7);
      g.strokeWeight(0.8);
      g.line(0, -r * 0.8, 0, r * 0.8);
      g.noStroke();
      g.fill(col[0] + 20, col[1] + 10, col[2] + 60, alpha * 0.8);
      g.ellipse(0, -r * 0.85, r * 0.35, r * 0.35);
      g.ellipse(0,  r * 0.85, r * 0.35, r * 0.35);
    }
  },
  weed: {
    baseCol: () => [random(200,240), random(160,200), random(40,100)],
    alpha:   () => random(150, 220),
    r:       () => random(4, 8.5),
    vy:      () => random(0.18, 0.55),
    vx:      () => random(-0.08, 0.08),
    draw(g, r, col, alpha, angle) {
      g.fill(col[0], col[1], col[2], alpha);
      const lobes = 6;
      g.beginShape();
      for (let i = 0; i < lobes * 4; i++) {
        const ang = (i / (lobes * 4)) * TWO_PI + angle;
        const bump = 1 + 0.28 * sin(i * (lobes / 2));
        g.curveVertex(cos(ang) * r * bump, sin(ang) * r * bump);
      }
      g.endShape(CLOSE);
      g.fill(col[0] - 25, col[1] - 20, col[2] - 10, alpha * 0.6);
      g.ellipse(0, 0, r * 0.75, r * 0.75);
      g.fill(col[0] + 20, col[1] + 15, col[2] + 30, alpha * 0.9);
      g.ellipse(0, 0, r * 0.3, r * 0.3);
    }
  }
};

// ── Wind system ───────────────────────────────────────────────────
class WindField {
  constructor() {
    this.cellW = 0; this.cellH = 0;
    this.tOffset = random(1000);
    this.gustTimer = 0; this.gustActive = false;
    this.gustDirX = 1; this.gustDirY = 0; this.gustStrength = 0;
  }
  init(w, h) { this.cellW = w / WIND_COLS; this.cellH = h / WIND_ROWS; }
  sample(x, y) {
    const col = floor(x / this.cellW);
    const row = floor(y / this.cellH);
    const nx = col * WIND_SCALE + this.tOffset;
    const ny = row * WIND_SCALE + this.tOffset * 0.7;
    const nz = frameCount * WIND_EVOLVE;
    const angle = noise(nx, ny, nz) * TWO_PI * 2;
    let wx = cos(angle) * WIND_STRENGTH;
    let wy = sin(angle) * WIND_STRENGTH * 0.45;
    if (this.gustActive) { wx += this.gustDirX * this.gustStrength; wy += this.gustDirY * this.gustStrength; }
    return { wx, wy };
  }
  update() {
    this.tOffset += WIND_EVOLVE * 0.5;
    this.gustTimer++;
    if (!this.gustActive && this.gustTimer >= GUST_INTERVAL) {
      this.gustActive = true; this.gustTimer = 0;
      const gustAngle = random(-0.4, 0.4);
      const side = random() < 0.5 ? 1 : -1;
      this.gustDirX = cos(gustAngle) * side;
      this.gustDirY = sin(gustAngle);
      this.gustStrength = 0;
    }
    if (this.gustActive) {
      const half = GUST_DURATION / 2, t = this.gustTimer;
      this.gustStrength = t < half ? map(t, 0, half, 0, 2.2) : map(t, half, GUST_DURATION, 2.2, 0);
      if (this.gustTimer >= GUST_DURATION) { this.gustActive = false; this.gustTimer = 0; }
    }
  }
  drawOverlay() {
    noFill();
    for (let col = 0; col < WIND_COLS; col++) {
      for (let row = 0; row < WIND_ROWS; row++) {
        const cx = (col + 0.5) * this.cellW, cy = (row + 0.5) * this.cellH;
        const { wx, wy } = this.sample(cx, cy);
        const spd = sqrt(wx*wx + wy*wy);
        const a = map(spd, 0, 2.5, 5, 26), len = map(spd, 0, 2.5, 4, 13);
        stroke(200, 190, 140, a); strokeWeight(0.6);
        const ang = atan2(wy, wx);
        const ex = cx + cos(ang) * len, ey = cy + sin(ang) * len;
        line(cx, cy, ex, ey);
        line(ex, ey, ex + cos(ang + PI * 0.8) * 3, ey + sin(ang + PI * 0.8) * 3);
        line(ex, ey, ex + cos(ang - PI * 0.8) * 3, ey + sin(ang - PI * 0.8) * 3);
      }
    }
    noStroke();
  }
}

// ── globals ───────────────────────────────────────────────────────
let pollenGfx, bodyPose, video;
let poses = [];
let particles = [];
let W, H;
let typeCounts = { tree: 0, grass: 0, weed: 0 };
let wind;
let statusMsg = '📷 Starting camera…';

let handPoints     = [];
let prevHandPoints = [];

// ── Pollen class ──────────────────────────────────────────────────
class Pollen {
  constructor(zoneIndex) {
    this.zoneIndex   = zoneIndex;
    this.type        = ZONE_DEFS[zoneIndex].type;
    this.faceOffsetX = 0;
    this.faceOffsetY = 0;
    this.hasFaceSlot = false;
    this.faceId      = null;
    this.reset(true);
  }

  zoneLeft()  { return this.zoneIndex * (W / 3); }
  zoneRight() { return (this.zoneIndex + 1) * (W / 3); }

  reset(initial = false) {
    const T = POLLEN_TYPES[this.type];
    const zl = this.zoneLeft();
    const zw = W / 3;
    this.x       = zl + random(zw);
    this.y       = initial ? random(H) : random(-40, -5);
    this.r       = T.r();
    this.baseCol = T.baseCol();
    this.alpha   = T.alpha();
    this.vx      = T.vx();
    this.vy      = T.vy();
    this.baseVy  = this.vy;
    this.angle   = random(TWO_PI);
    this.spin    = random(-0.025, 0.025);
    this.inOrbit = false;
    this.hasFaceSlot = false;
    this.faceId = null;
    this.stunTimer = 0;
  }
  
  attract(hx, hy, faceId) {
    if (this.stunTimer > 0) {
      this.stunTimer--;
      return; 
    }

    if (hx < this.zoneLeft() || hx > this.zoneRight()) {
      this.hasFaceSlot = false;
      this.faceId = null;
      return;
    }
    const d = dist(this.x, this.y, hx, hy);
    if (d > ATTRACT_RADIUS) {
      this.hasFaceSlot = false;
      this.faceId = null;
      return;
    }
    if (!this.hasFaceSlot || this.faceId !== faceId) {
      const angle = random(TWO_PI);
      const rx = FACE_SPREAD * random(0.05, 1.0);
      const ry = FACE_SPREAD * 1.35 * random(0.05, 1.0);
      this.faceOffsetX = cos(angle) * rx;
      this.faceOffsetY = sin(angle) * ry;
      this.hasFaceSlot = true;
      this.faceId = faceId;
    }
    const targetX = hx + this.faceOffsetX;
    const targetY = hy + this.faceOffsetY;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dd = sqrt(dx*dx + dy*dy) + 0.001;
    const force = map(dd, 0, 200, 0.06, 0.22) * STICK_FORCE;
    this.vx += (dx / dd) * force;
    this.vy += (dy / dd) * force;
    this.spin    = random(-0.08, 0.08);
    this.inOrbit = true;
  }

  wipe(handX, handY, hdx, hdy) {
    if (!this.hasFaceSlot) return;
    const d = dist(this.x, this.y, handX, handY);
    if (d > WIPE_RADIUS) return;
    const handSpeed = sqrt(hdx*hdx + hdy*hdy);
    if (handSpeed < WIPE_SPEED_MIN) return;
    
    this.inOrbit     = false;
    this.vx = hdx * WIPE_FLING_SCALE + random(-5, 5);
    this.vy = hdy * WIPE_FLING_SCALE + random(-5, 5);
    this.spin = random(-0.5, 0.5);

    this.stunTimer = random(30, 70);
  }

  update() {
    const { wx, wy } = wind.sample(this.x, this.y);
    const drag = WIND_DRAG[this.type];

    this.x += this.vx + sin(frameCount * 0.01 + this.y * 0.05) * 0.1 + wx * drag;
    this.y += this.vy + wy * drag * 0.5;
    this.angle += this.spin;

    const windSpd = sqrt(wx*wx + wy*wy);
    this.spin += (windSpd * drag * 0.004 - this.spin) * 0.05;

    if (this.inOrbit) {
      this.vx *= FRICTION;
      this.vy *= FRICTION;
      this.vy += 0.002;
      this.inOrbit = false;
    } else {
      this.vy += 0.003;
      if (this.vy < this.baseVy * 0.25) this.vy += 0.006;
    }

    const zl = this.zoneLeft();
    const zr = this.zoneRight();

    if (this.hasFaceSlot) {
      if (this.x < 0) { this.x = 0; this.vx = abs(this.vx) * 0.5; }
      if (this.x > W) { this.x = W; this.vx = -abs(this.vx) * 0.5; }
    } else {
      if (this.x < zl) { 
        this.vx += 0.08; 
      } else if (this.x > zr) { 
        this.vx -= 0.08; 
      }
      
      if (this.x < 0) { this.x = 0; this.vx = abs(this.vx) * 0.5; }
      if (this.x > W) { this.x = W; this.vx = -abs(this.vx) * 0.5; }
    }

    if (this.y > H + 20) this.reset();
    if (this.y < -60)    this.y = -40;
  }

  draw(g) {
    const T = POLLEN_TYPES[this.type];
    g.push();
    g.translate(this.x, this.y);
    g.rotate(this.angle);
    g.noStroke();
    const a = this.inOrbit ? min(this.alpha * 1.18, 255) : this.alpha;
    T.draw(g, this.r, this.baseCol, a, this.angle);
    g.pop();
  }
}

// ── p5 setup ──────────────────────────────────────────────────────
function setup() {
  W = SIM_W;
  H = SIM_H;
  
  let cnv = createCanvas(W, H);
  cnv.style('position', 'absolute');
  cnv.style('top', '0px');
  cnv.style('left', '0px');
  cnv.style('transform-origin', 'top left');
  
  pollenGfx = createGraphics(W, H);
  wind = new WindField();
  wind.init(W, H);

  const perZone = floor(POLLEN_COUNT / 3);
  for (let z = 0; z < 3; z++) {
    for (let i = 0; i < perZone; i++) particles.push(new Pollen(z));
  }

  ['clearBtn','bloomBtn','modeBtn','status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  startBodyPose();
  updateCanvasTransform();
}

function updateCanvasTransform() {
  const canvasEl = document.querySelector('canvas');
  if (!canvasEl) return;
  canvasEl.style.transform = `scale(${currentScale})`;
  canvasEl.style.left = `0px`;
  canvasEl.style.top  = `0px`;
}

function fitCanvasToWindow() {
  currentScale = min(windowWidth / W, windowHeight / H);
  updateCanvasTransform();
}

function startBodyPose() {
  statusMsg = '';
  video = createCapture(VIDEO, () => {
    video.style('position', 'absolute');
    video.style('opacity', '0');
    video.style('pointer-events', 'none');
    bodyPose = ml5.bodyPose(video, { flipped: false }, () => {
      statusMsg = '';
      bodyPose.detectStart(video, (results) => {
        poses = results;
        if (results.length > 0) statusMsg = '';
      });
    });
  });
}

// ── p5 draw ───────────────────────────────────────────────────────
function draw() {
  if (video && video.width > 0) {
    vScale = max(W / video.width, H / video.height);
    const vW = video.width * vScale;
    const vH = video.height * vScale;
    vX = (W - vW) / 2;
    vY = (H - vH) / 2;

    push(); 
    translate(W, 0); 
    scale(-1, 1);
    image(video, vX, vY, vW, vH);
    pop();
  } else {
    background(37, 28, 10);
  }

  wind.update();

  noStroke();
  for (let z = 0; z < 3; z++) {
    const [r, g, b, a] = ZONE_DEFS[z].tint;
    fill(r, g, b, a);
    rect(z * (W / 3), 0, W / 3, H);
  }

  // Season labels
  textAlign(CENTER, TOP);
  textSize(56);
  for (let z = 0; z < 3; z++) {
    const cx = z * (W / 3) + (W / 6);
    const label = ZONE_DEFS[z].label;
      noStroke();
      fill(64, 44, 18, 150);
    rectMode(CENTER);
    rect(cx, 92, textWidth(label) + 60, 92, 14);
      fill(255, 246, 222, 240);
    text(label, cx, 52);
  }
  rectMode(CORNER);

  const ctx = drawingContext;
  ctx.save();
  const grad = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.85);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(36,24,8,0.42)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  for (let z = 0; z < 3; z++) {
    const zx = z * (W / 3);
    if (z > 0) {
      stroke(255, 230, 170, 38); strokeWeight(1);
      line(zx, 0, zx, H);
      noStroke();
    }
  }

  if (SHOW_WIND) wind.drawOverlay();

  // ── face attractor ────────────────────────────────────────────
  const attractors = [];
  for (let pi = 0; pi < poses.length; pi++) {
    const pose = poses[pi];
    let sumX = 0, sumY = 0, count = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const idx of HEAD_KEYPOINTS) {
      const kp = pose.keypoints[idx];
      if (!kp || kp.confidence < CONFIDENCE) continue;
      const sx = W - (kp.x * vScale + vX);
      const sy = (kp.y * vScale + vY);
      sumX += sx;
      sumY += sy;
      if (sx < minX) minX = sx;
      if (sy < minY) minY = sy;
      if (sx > maxX) maxX = sx;
      if (sy > maxY) maxY = sy;
      count++;
    }
    if (count <= 0) continue;
    const hx = sumX / count;
    const hy = sumY / count;
    const faceW = maxX - minX;
    const faceH = maxY - minY;
    const faceBoxSize = max(faceW, faceH) * 2.2 + 40;
    attractors.push({ id: pi, hx, hy, faceBoxSize });
  }

  // ── hand tracking ─────────────────────────────────────────────
  prevHandPoints = handPoints.slice();
  handPoints = [];
  for (let pi = 0; pi < poses.length; pi++) {
    const pose = poses[pi];

    const getHandPos = (elbowIdx, wristIdx) => {
      const elbow = pose.keypoints[elbowIdx];
      const wrist = pose.keypoints[wristIdx];
      if (elbow && wrist && elbow.confidence > CONFIDENCE && wrist.confidence > CONFIDENCE) {
        const ex = W - (elbow.x * vScale + vX);
        const ey = (elbow.y * vScale + vY);
        const wx = W - (wrist.x * vScale + vX);
        const wy = (wrist.y * vScale + vY);
        return { x: wx + (wx - ex) * 0.3, y: wy + (wy - ey) * 0.3 };
      }
      return null;
    };

    const leftPalm  = getHandPos(7, 9);
    const rightPalm = getHandPos(8, 10);

    if (leftPalm)  handPoints.push(leftPalm);
    if (rightPalm) handPoints.push(rightPalm);
  }
  
  const hands = handPoints.map((hp, i) => {
    const prev = prevHandPoints[i];
    return { x: hp.x, y: hp.y, hdx: prev ? hp.x - prev.x : 0, hdy: prev ? hp.y - prev.y : 0 };
  });

  pollenGfx.clear();
  typeCounts = { tree: 0, grass: 0, weed: 0 };

  for (const pk of particles) {
    let best = null;
    let bestD = Infinity;
    for (const a of attractors) {
      if (a.hx < pk.zoneLeft() || a.hx > pk.zoneRight()) continue;
      const d = dist(pk.x, pk.y, a.hx, a.hy);
      if (d > ATTRACT_RADIUS) continue;
      if (d < bestD) { bestD = d; best = a; }
    }
    if (best) pk.attract(best.hx, best.hy, best.id);
    else { pk.hasFaceSlot = false; pk.faceId = null; }
    for (const h of hands) pk.wipe(h.x, h.y, h.hdx, h.hdy);
    pk.update();
    pk.draw(pollenGfx);
    typeCounts[pk.type]++;
  }
  image(pollenGfx, 0, 0);

  for (const h of hands) {
    const spd = sqrt(h.hdx*h.hdx + h.hdy*h.hdy);
    if (spd > WIPE_SPEED_MIN * 0.5) {
      const alpha = map(spd, WIPE_SPEED_MIN * 0.5, 20, 25, 110);
      noFill(); stroke(255, 240, 200, alpha); strokeWeight(1.2);
      ellipse(h.x, h.y, WIPE_RADIUS * 2, WIPE_RADIUS * 2);
      noStroke();
    }
  }
  drawDebug(attractors, hands);
}


function drawDebug(attractors, hands) {
  push();
  
  fill(0, 255, 0, 180); 
  noStroke();
  const L = 40;
  triangle(0, 0, L, 0, 0, L);
  triangle(W, 0, W - L, 0, W, L);
  triangle(0, H, L, H, 0, H - L);
  triangle(W, H, W - L, H, W, H - L);

  stroke(204, 255, 174);
  strokeWeight(2);
  line(W/2 - 20, H/2, W/2 + 20, H/2);
  line(W/2, H/2 - 20, W/2, H/2 + 20);

  noFill();
  strokeWeight(FACE_BOX_STROKE_WEIGHT);

  // Tally pollen currently stuck to each face
  const faceStats = {};
  for (const pk of particles) {
    if (!pk.hasFaceSlot || pk.faceId === null || pk.faceId === undefined) continue;
    const fid = pk.faceId;
    if (!faceStats[fid]) faceStats[fid] = { total: 0, typeCounts: { tree: 0, grass: 0, weed: 0 } };
    faceStats[fid].total++;
    faceStats[fid].typeCounts[pk.type] = (faceStats[fid].typeCounts[pk.type] || 0) + 1;
  }

  for (const a of attractors) {
    const stats = faceStats[a.id] || { total: 0, typeCounts: { tree: 0, grass: 0, weed: 0 } };
    const faceTypeCounts = stats.typeCounts;

    // Find the dominant pollen type for this face
    let faceType = 'tree';
    let dominantCount = 0;
    for (const t of Object.keys(faceTypeCounts)) {
      if (faceTypeCounts[t] > dominantCount) {
        dominantCount = faceTypeCounts[t];
        faceType = t;
      }
    }

    const s = a.faceBoxSize ?? 180;
    rectMode(CENTER);

    const currentThreshold = POLLEN_THRESHOLDS[faceType];
    const shouldBlink = dominantCount >= currentThreshold;
    const showBox = !shouldBlink || (frameCount % 24) < 12;
    if (showBox) {
      noFill();
      stroke(255, 160, 95, 235);
      rect(a.hx, a.hy, s, s);
    }

    const drawBadge = (label, x, y, alignH, alignV, size) => {
      textSize(size);
      textAlign(alignH, alignV);
      const padX = 18, padY = 14;
      const tw = textWidth(label);
      const th = textAscent() + textDescent();
      let bx = x, by = y;
      if (alignH === CENTER) bx -= tw / 2;
      if (alignH === RIGHT)  bx -= tw;
      if (alignV === CENTER) by -= th / 2;
      if (alignV === BOTTOM) by -= th;
      noStroke();
      rectMode(CORNER);
      fill(238, 140, 72, 235);
      rect(bx - padX, by - padY, tw + padX * 2, th + padY * 2, 8);
      fill(255, 249, 232, 250);
      text(label, x, y);
    };

    const drawSymptomBadge = (label, x, y, alignH, alignV, size, severityIndex, birthFrame) => {
      textSize(size);
      textAlign(alignH, alignV);
      const padX = 18, padY = 14;
      const tw = textWidth(label);
      const th = textAscent() + textDescent();
      const level = constrain(severityIndex, 0, SYMPTOM_SEVERITY_COLORS.length - 1);
      const col = SYMPTOM_SEVERITY_COLORS[level];
      const age = frameCount - birthFrame;
      const t = constrain(age / SYMPTOM_POPIN_FRAMES, 0, 1);
      const eased = 1 - pow(1 - t, 3);
      const rise = (1 - eased) * 22;
      const alphaScale = map(t, 0, 1, 0.1, 1);
      const scaleAmt = 0.86 + eased * 0.14;
      let bx = x, by = y;
      if (alignH === CENTER) bx -= tw / 2;
      if (alignH === RIGHT)  bx -= tw;
      if (alignV === CENTER) by -= th / 2;
      if (alignV === BOTTOM) by -= th;

      push();
      translate(x, y - rise);
      scale(scaleAmt);
      noStroke();
      rectMode(CENTER);
      fill(34, 22, 8, 190 * alphaScale);
      rect(0, 3, tw + padX * 2 + 12, th + padY * 2 + 12, 16);
      fill(col[0], col[1], col[2], 240 * alphaScale);
      rect(0, 0, tw + padX * 2, th + padY * 2, 14);
      fill(255, 249, 230, 250 * alphaScale);
      text(label, 0, 0);
      pop();
    };

    // HUD Badges — now using labelTextSize
    drawBadge(faceType.toUpperCase(), a.hx - s / 2 + 6, a.hy - s / 2 - 10, LEFT, BOTTOM, labelTextSize);
    drawBadge(`${dominantCount}`, a.hx - s / 2 + 2, a.hy + s / 2 + 16, LEFT, TOP, labelTextSize);
    drawBadge(`Limit: ${currentThreshold}`, a.hx + s / 2 - 2, a.hy + s / 2 + 16, RIGHT, TOP, labelTextSize);

    // Calculate progressive symptom tier based on ratio
    let targetSymptoms = 0;
    const ratio = dominantCount / currentThreshold;
    if (ratio >= 0.5) targetSymptoms = 1;
    if (ratio >= 1.0) targetSymptoms = 2;
    if (ratio >= 1.5) targetSymptoms = 3;
    if (ratio >= 2.0) targetSymptoms = 4;
    if (ratio >= 2.5) targetSymptoms = 5;

    // Manage symptom burst lifecycle
    if (!symptomBursts[a.id]) symptomBursts[a.id] = { type: null, shown: 0, nextFrame: 0, items: [] };
    const symptomBurst = symptomBursts[a.id];
    if (symptomBurst.type !== faceType) {
      symptomBurst.type = faceType;
      symptomBurst.shown = 0;
      symptomBurst.nextFrame = frameCount;
      symptomBurst.items = [];
    }

    const lines = POLLEN_SYMPTOMS[faceType] || [];
    const maxToShow = Math.min(targetSymptoms, lines.length);

    // Add symptoms progressively
    if (symptomBurst.shown < maxToShow && frameCount >= symptomBurst.nextFrame) {
      const label = lines[symptomBurst.shown];
      const symptomSize = labelTextSize; // scales with label text size for correct collision sizing
      textSize(symptomSize);
      const tw = textWidth(label);
      const th = textAscent() + textDescent();
      const padX = 18, padY = 14;
      const boxW = tw + padX * 2;
      const boxH = th + padY * 2;
      const margin = 18;
      const ring = 26;
      const minSep = 26;
      
      let px = a.hx + s / 2 + margin;
      let py = a.hy - s / 2;
      
      for (let tries = 0; tries < 30; tries++) {
        const ang = random(TWO_PI);
        const r = (s / 2) + ring + random(0, 70);
        px = a.hx + cos(ang) * r;
        py = a.hy + sin(ang) * r;
        px = constrain(px, 10 + boxW / 2, W - 10 - boxW / 2);
        py = constrain(py, 10 + boxH / 2, H - 10 - boxH / 2);
        if (!(abs(px - a.hx) > s / 2 + margin || abs(py - a.hy) > s / 2 + margin)) continue;

        let ok = true;
        for (const it of symptomBurst.items) {
          const dx = px - it.x;
          const dy = py - it.y;
          if (sqrt(dx*dx + dy*dy) < max(boxW, boxH) * 0.55 + minSep) { ok = false; break; }
        }
        if (ok) break;
      }

      symptomBurst.items.push({
        text: label,
        offsetX: px - a.hx,
        offsetY: py - a.hy,
        severity: symptomBurst.shown,
        bornFrame: frameCount
      });
      symptomBurst.shown++;
      symptomBurst.nextFrame = frameCount + SYMPTOM_REVEAL_INTERVAL_FRAMES;
    }

    // Remove symptoms if pollen count drops below tier
    while (symptomBurst.shown > maxToShow) {
      symptomBurst.items.pop();
      symptomBurst.shown--;
    }

    // Draw revealed symptoms — now using labelTextSize
    for (const it of symptomBurst.items) {
      const followX = a.hx + it.offsetX;
      const followY = a.hy + it.offsetY;
      const clampedX = constrain(followX, 20, W - 20);
      const clampedY = constrain(followY, 20, H - 20);
      drawSymptomBadge(
        it.text,
        clampedX,
        clampedY,
        CENTER,
        CENTER,
        labelTextSize,
        it.severity,
        it.bornFrame
      );
    }
  }

  stroke(255, 0, 255, 200);
  for (const h of hands) {
    circle(h.x, h.y, 100); 
  }
  pop();
}

function windowResized() {
  updateCanvasTransform();
}

function keyPressed() {
  const canvasEl = document.querySelector('canvas');
  if (!canvasEl) return;

  if (keyCode === UP_ARROW) {
    currentScale += 0.1;
    updateCanvasTransform();
    return false;
  } else if (keyCode === DOWN_ARROW) {
    currentScale = max(0.1, currentScale - 0.1);
    updateCanvasTransform();
    return false;
  } else if (keyCode === LEFT_ARROW) {
    labelTextSize = max(LABEL_TEXT_SIZE_MIN, labelTextSize - LABEL_TEXT_SIZE_STEP);
    return false;
  } else if (keyCode === RIGHT_ARROW) {
    labelTextSize = min(LABEL_TEXT_SIZE_MAX, labelTextSize + LABEL_TEXT_SIZE_STEP);
    return false;
  }
}
