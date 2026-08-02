const activateBtn = document.getElementById("activateBtn");
const overlay = document.getElementById("activationOverlay");
const hologramCanvas = document.getElementById("hologram");
const starfieldCanvas = document.getElementById("starfield");
const hctx = hologramCanvas.getContext("2d");
const sctx = starfieldCanvas.getContext("2d");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const TAU = Math.PI * 2;

const state = {
  mode: "idle",
  wakePhrase: "hey rogue",
  recognition: null,
  keepListening: false,
  recognizing: false,
  listeningForCommand: false,
  speaking: false,
  thinking: false,
  audioContext: null,
  analyser: null,
  micArray: null,
  micStream: null,
  voice: null,
  lastVoiceEnergy: 0,
  history: JSON.parse(localStorage.getItem("rogue_voice_history") || "[]"),
  particles: [],
  stars: [],
  arcs: [],
  sparks: [],
  filaments: [],
  pointerX: 0,
  pointerY: 0,
  targetPointerX: 0,
  targetPointerY: 0,
  lastFrame: performance.now()
};

function setMode(mode) {
  state.mode = mode;
  document.body.dataset.state = mode;
}

function saveHistory() {
  localStorage.setItem(
    "rogue_voice_history",
    JSON.stringify(state.history.slice(-14))
  );
}

function resizeCanvas(canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeAll() {
  resizeCanvas(hologramCanvas, hctx);
  resizeCanvas(starfieldCanvas, sctx);
  seedScene();
}

window.addEventListener("resize", resizeAll);

window.addEventListener("pointermove", (event) => {
  state.targetPointerX = (event.clientX / window.innerWidth - 0.5) * 2;
  state.targetPointerY = (event.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener("pointerleave", () => {
  state.targetPointerX = 0;
  state.targetPointerY = 0;
});

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function seedScene() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const radius = Math.min(width, height) * 0.34;

  state.stars = Array.from(
    { length: Math.floor((width * height) / 9000) },
    () => ({
      x: random(0, width),
      y: random(0, height),
      r: random(0.25, 1.3),
      a: random(0.08, 0.65),
      speed: random(0.08, 0.28),
      drift: random(-0.025, 0.025)
    })
  );

  state.particles = Array.from({ length: 260 }, () => ({
    angle: random(0, TAU),
    radius: random(radius * 0.28, radius * 1.2),
    speed: random(-0.28, 0.31),
    size: random(0.35, 2.4),
    alpha: random(0.14, 0.95),
    wobble: random(0.2, 1.5),
    phase: random(0, TAU),
    plane: random(-0.42, 0.42),
    eccentricity: random(0.5, 1)
  }));

  state.arcs = Array.from({ length: 42 }, () => {
    const start = random(0, TAU);
    return {
      radius: random(radius * 0.24, radius * 1.14),
      start,
      length: random(0.04, 0.74),
      speed: random(-0.34, 0.34),
      width: random(0.35, 2.1),
      alpha: random(0.06, 0.55),
      dash: Math.random() > 0.48 ? [random(2, 12), random(4, 16)] : [],
      tilt: random(-0.42, 0.42)
    };
  });

  state.filaments = Array.from({ length: 18 }, () => ({
    angle: random(0, TAU),
    radius: random(radius * 0.18, radius * 0.82),
    span: random(0.2, 1.2),
    speed: random(-0.5, 0.5),
    phase: random(0, TAU),
    alpha: random(0.08, 0.4)
  }));
}

function micEnergy() {
  if (!state.analyser || !state.micArray) return 0;

  state.analyser.getByteTimeDomainData(state.micArray);

  let sum = 0;
  for (let i = 0; i < state.micArray.length; i++) {
    const value = (state.micArray[i] - 128) / 128;
    sum += value * value;
  }

  const rms = Math.sqrt(sum / state.micArray.length);
  const target = Math.min(1, rms * 5.6);
  state.lastVoiceEnergy += (target - state.lastVoiceEnergy) * 0.23;
  return state.lastVoiceEnergy;
}

function simulatedEnergy(time) {
  if (state.mode === "thinking") {
    return (
      0.18 +
      Math.abs(Math.sin(time * 4.1)) * 0.18 +
      Math.abs(Math.sin(time * 1.7)) * 0.06
    );
  }

  if (state.mode === "speaking") {
    return (
      0.24 +
      Math.abs(Math.sin(time * 8.1)) * 0.2 +
      Math.abs(Math.sin(time * 3.9)) * 0.13 +
      Math.abs(Math.sin(time * 13.7)) * 0.06
    );
  }

  return (
    0.035 +
    Math.abs(Math.sin(time * 0.9)) * 0.028 +
    Math.abs(Math.sin(time * 0.23)) * 0.012
  );
}

function modeEnergy(time) {
  if (state.mode === "listening") {
    return Math.max(0.085, micEnergy());
  }
  return simulatedEnergy(time);
}

function glowStroke(ctx, color, blur, width) {
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.lineWidth = width;
}

function drawStars(time) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  sctx.clearRect(0, 0, width, height);

  for (const star of state.stars) {
    star.x += star.drift;
    if (star.x < 0) star.x = width;
    if (star.x > width) star.x = 0;

    const flicker = 0.55 + Math.sin(time * star.speed + star.x) * 0.35;
    sctx.fillStyle = `rgba(255, 190, 62, ${star.a * flicker})`;
    sctx.fillRect(star.x, star.y, star.r, star.r);
  }

  const vignette = sctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.68, "rgba(0,0,0,0.22)");
  vignette.addColorStop(1, "rgba(0,0,0,0.84)");
  sctx.fillStyle = vignette;
  sctx.fillRect(0, 0, width, height);
}

function drawConcentricRing(
  cx,
  cy,
  radius,
  rotation,
  segments,
  alpha,
  width,
  dash = [],
  tilt = 0,
  energy = 0
) {
  hctx.save();
  hctx.translate(cx, cy);
  hctx.rotate(rotation);
  hctx.scale(1, 0.82 + tilt * 0.22);
  hctx.setLineDash(dash);
  glowStroke(
    hctx,
    `rgba(255, 172, 25, ${alpha})`,
    10 * alpha + energy * 12,
    width + energy * 0.35
  );

  for (let i = 0; i < segments; i++) {
    const step = TAU / segments;
    const gap = step * (0.12 + ((i * 37) % 13) / 100);
    const jitter = Math.sin(i * 1.91 + rotation * 3.2) * step * 0.04;
    const start = i * step + gap + jitter;
    const end =
      (i + 1) * step -
      gap * (0.55 + ((i * 17) % 9) / 20) +
      jitter;

    hctx.beginPath();
    hctx.arc(0, 0, radius * (1 + Math.sin(i * 2.7 + rotation) * 0.002), start, end);
    hctx.stroke();
  }

  hctx.restore();
}

function drawRadialSpokes(cx, cy, radius, time, energy) {
  hctx.save();
  hctx.translate(cx, cy);
  hctx.rotate(time * 0.022 + state.pointerX * 0.06);
  hctx.scale(1, 0.78 + state.pointerY * 0.035);

  const spokes = 88;
  for (let i = 0; i < spokes; i++) {
    const angle = (i / spokes) * TAU;
    const pulseWave = Math.sin(time * 2.4 + i * 0.71) * 0.5 + 0.5;
    const inner = radius * (0.22 + ((i * 11) % 19) / 55);
    const outer =
      radius *
      (0.82 + ((i * 7) % 17) / 58 + pulseWave * energy * 0.06);
    const pulse =
      0.08 +
      (i % 7 === 0 ? 0.26 : 0.07) +
      energy * 0.2 * pulseWave;

    hctx.beginPath();
    hctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    hctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    glowStroke(
      hctx,
      `rgba(255, 163, 13, ${pulse})`,
      3 + energy * 6,
      i % 9 === 0 ? 1.15 : 0.48
    );
    hctx.stroke();
  }

  hctx.restore();
}

function drawOrbitEllipses(cx, cy, radius, time, energy) {
  const orbitCount = 10;

  for (let i = 0; i < orbitCount; i++) {
    hctx.save();
    hctx.translate(cx, cy);
    hctx.rotate(
      time * (0.017 + i * 0.004) * (i % 2 ? -1 : 1) +
        i * 0.61 +
        state.pointerX * 0.08
    );
    hctx.scale(
      1,
      0.31 +
        i * 0.048 +
        Math.sin(time * 0.6 + i) * 0.018 +
        state.pointerY * 0.015
    );

    hctx.beginPath();
    hctx.arc(0, 0, radius * (0.48 + i * 0.052), 0, TAU);

    glowStroke(
      hctx,
      `rgba(255, 181, 38, ${0.075 + energy * 0.11})`,
      7 + energy * 8,
      i % 2 ? 0.65 : 1.05
    );
    hctx.stroke();
    hctx.restore();
  }
}

function drawCore(cx, cy, radius, time, energy) {
  const breath =
    1 +
    energy * 0.18 +
    Math.sin(time * 1.45) * 0.026 +
    Math.sin(time * 0.37) * 0.012;
  const coreRadius = radius * 0.102 * breath;

  const haloRadius = coreRadius * (4.7 + energy * 0.7);
  const outer = hctx.createRadialGradient(cx, cy, 0, cx, cy, haloRadius);
  outer.addColorStop(0, `rgba(255,255,220,${0.92 + energy * 0.08})`);
  outer.addColorStop(0.12, "rgba(255,231,135,0.9)");
  outer.addColorStop(0.32, `rgba(255,160,0,${0.38 + energy * 0.2})`);
  outer.addColorStop(1, "rgba(255,120,0,0)");
  hctx.fillStyle = outer;
  hctx.beginPath();
  hctx.arc(cx, cy, haloRadius, 0, TAU);
  hctx.fill();

  for (let i = 0; i < 4; i++) {
    hctx.save();
    hctx.translate(cx, cy);
    hctx.rotate(time * (0.19 + i * 0.07) * (i % 2 ? -1 : 1) + i * 1.2);
    hctx.scale(1, 0.72 + i * 0.05);
    hctx.beginPath();
    hctx.arc(
      0,
      0,
      coreRadius * (1.5 + i * 0.28),
      0.14 + i * 0.3,
      2.1 + i * 0.46
    );
    glowStroke(
      hctx,
      `rgba(255, 235, 155, ${0.62 - i * 0.09 + energy * 0.16})`,
      16 + energy * 24,
      1.5 + energy * 1.4
    );
    hctx.stroke();
    hctx.restore();
  }

  const nucleus = hctx.createRadialGradient(
    cx - coreRadius * 0.18,
    cy - coreRadius * 0.18,
    0,
    cx,
    cy,
    coreRadius
  );
  nucleus.addColorStop(0, "#fffef1");
  nucleus.addColorStop(0.3, "#fff2a8");
  nucleus.addColorStop(0.65, "#ffc22c");
  nucleus.addColorStop(1, "rgba(255,133,0,0.75)");

  hctx.fillStyle = nucleus;
  hctx.shadowColor = "#ffb017";
  hctx.shadowBlur = 24 + energy * 46;
  hctx.beginPath();
  hctx.arc(cx, cy, coreRadius * (0.5 + energy * 0.12), 0, TAU);
  hctx.fill();
  hctx.shadowBlur = 0;
}

function drawVoiceMembrane(cx, cy, radius, time, energy) {
  const points = 320;
  const baseRadius = radius * 0.44;
  const amplitude = radius * (0.018 + energy * 0.135);

  for (let layer = 0; layer < 3; layer++) {
    hctx.save();
    hctx.translate(cx, cy);
    hctx.rotate(time * (-0.048 + layer * 0.016) + layer * 0.35);
    hctx.scale(1, 0.34 + layer * 0.03);

    hctx.beginPath();

    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * TAU;
      const envelope = Math.pow(Math.sin(angle * 0.5), 2);
      const modulation =
        Math.sin(angle * (8 + layer * 2) + time * (4.6 + layer)) *
          amplitude *
          envelope +
        Math.sin(angle * (15 + layer * 3) - time * 3.2) *
          amplitude *
          0.33 +
        Math.sin(angle * 3 + time * 1.2) * amplitude * 0.12;

      const rr = baseRadius * (1 + layer * 0.055) + modulation;
      const x = Math.cos(angle) * rr;
      const y = Math.sin(angle) * rr;

      if (i === 0) hctx.moveTo(x, y);
      else hctx.lineTo(x, y);
    }

    glowStroke(
      hctx,
      `rgba(255, 213, 104, ${0.19 + layer * 0.09 + energy * 0.34})`,
      12 + energy * 22,
      0.8 + layer * 0.32 + energy * 1.3
    );
    hctx.stroke();
    hctx.restore();
  }
}

function drawParticles(cx, cy, radius, time, energy) {
  for (const particle of state.particles) {
    particle.angle +=
      particle.speed *
      0.0025 *
      (state.mode === "thinking" ? 2.2 : state.mode === "speaking" ? 1.45 : 1);

    const orbitPulse =
      Math.sin(time * particle.wobble + particle.phase) * radius * 0.026;
    const rr = particle.radius + orbitPulse + energy * radius * particle.plane * 0.025;

    const z = Math.sin(particle.angle + particle.phase) * particle.eccentricity;
    const perspective = 0.76 + z * 0.12;

    const x =
      cx +
      Math.cos(particle.angle) * rr +
      state.pointerX * radius * 0.028 * perspective;
    const y =
      cy +
      Math.sin(particle.angle) *
        rr *
        (0.59 + particle.plane * 0.25) +
      state.pointerY * radius * 0.018;

    const alpha =
      particle.alpha *
      (0.54 + perspective * 0.46) *
      (0.7 + energy * 0.36);

    hctx.fillStyle = `rgba(255, 184, 42, ${alpha})`;
    hctx.shadowColor = "#ff9c00";
    hctx.shadowBlur = particle.size * (4 + energy * 5);
    hctx.beginPath();
    hctx.arc(
      x,
      y,
      particle.size * (0.65 + perspective * 0.5 + energy * 0.35),
      0,
      TAU
    );
    hctx.fill();
  }
  hctx.shadowBlur = 0;
}

function drawArcs(cx, cy, time, energy) {
  for (const arc of state.arcs) {
    const start = arc.start + time * arc.speed * 0.08;
    hctx.save();
    hctx.translate(cx, cy);
    hctx.rotate(state.pointerX * arc.tilt * 0.08);
    hctx.scale(1, 0.8 + arc.tilt * 0.18);
    hctx.setLineDash(arc.dash);
    hctx.beginPath();
    hctx.arc(0, 0, arc.radius, start, start + arc.length);
    glowStroke(
      hctx,
      `rgba(255, 171, 22, ${arc.alpha + energy * 0.16})`,
      8 + energy * 10,
      arc.width + energy * 0.45
    );
    hctx.stroke();
    hctx.restore();
  }
  hctx.setLineDash([]);
}

function drawFilaments(cx, cy, radius, time, energy) {
  for (const filament of state.filaments) {
    const baseAngle =
      filament.angle +
      time *
        filament.speed *
        0.12 *
        (state.mode === "thinking" ? 1.8 : 1);

    hctx.save();
    hctx.translate(cx, cy);
    hctx.rotate(baseAngle);
    hctx.scale(1, 0.7);

    hctx.beginPath();
    const points = 48;

    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const angle = t * filament.span;
      const rr =
        filament.radius +
        Math.sin(t * 9 + time * 3 + filament.phase) *
          radius *
          (0.006 + energy * 0.012);
      const x = Math.cos(angle) * rr;
      const y = Math.sin(angle) * rr;

      if (i === 0) hctx.moveTo(x, y);
      else hctx.lineTo(x, y);
    }

    glowStroke(
      hctx,
      `rgba(255, 202, 86, ${filament.alpha + energy * 0.12})`,
      9 + energy * 8,
      0.55 + energy * 0.7
    );
    hctx.stroke();
    hctx.restore();
  }
}

function maybeSpawnSpark(cx, cy, radius, energy) {
  const baseChance =
    state.mode === "thinking"
      ? 0.2
      : state.mode === "speaking"
      ? 0.14
      : state.mode === "listening"
      ? 0.08
      : 0.025;

  if (Math.random() > baseChance + energy * 0.22 || state.sparks.length > 70) {
    return;
  }

  const angle = random(0, TAU);
  const rr = random(radius * 0.18, radius * 1.04);
  const speed = random(0.6, 2.9) * (1 + energy * 1.6);

  state.sparks.push({
    x: cx + Math.cos(angle) * rr,
    y: cy + Math.sin(angle) * rr * 0.68,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1,
    size: random(0.5, 2.2)
  });
}

function drawSparks() {
  for (let i = state.sparks.length - 1; i >= 0; i--) {
    const spark = state.sparks[i];
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vx *= 0.995;
    spark.vy *= 0.995;
    spark.life -= 0.022;

    hctx.strokeStyle = `rgba(255, 228, 150, ${spark.life})`;
    hctx.lineWidth = Math.max(0.3, spark.size * spark.life);
    hctx.shadowColor = "#ff9c00";
    hctx.shadowBlur = 12;

    hctx.beginPath();
    hctx.moveTo(spark.x, spark.y);
    hctx.lineTo(spark.x - spark.vx * 4, spark.y - spark.vy * 4);
    hctx.stroke();

    if (spark.life <= 0) state.sparks.splice(i, 1);
  }
  hctx.shadowBlur = 0;
}

function drawEnergySweep(cx, cy, radius, time, energy) {
  const sweepAngle =
    time *
    (state.mode === "thinking"
      ? 1.35
      : state.mode === "speaking"
      ? 0.86
      : 0.28);

  hctx.save();
  hctx.translate(cx, cy);
  hctx.rotate(sweepAngle);
  const gradient = hctx.createLinearGradient(0, 0, radius, 0);
  gradient.addColorStop(0, "rgba(255,220,132,0)");
  gradient.addColorStop(0.65, `rgba(255,184,42,${0.025 + energy * 0.06})`);
  gradient.addColorStop(1, `rgba(255,229,157,${0.22 + energy * 0.25})`);
  hctx.fillStyle = gradient;
  hctx.beginPath();
  hctx.moveTo(0, 0);
  hctx.arc(0, 0, radius * 1.1, -0.025, 0.025);
  hctx.closePath();
  hctx.fill();
  hctx.restore();
}

function drawHologram(timeMs) {
  const time = timeMs / 1000;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const cx =
    width / 2 + state.pointerX * Math.min(width, height) * 0.018;
  const cy =
    height / 2 + state.pointerY * Math.min(width, height) * 0.012;
  const radius = Math.min(width, height) * (width < 700 ? 0.35 : 0.38);
  const energy = modeEnergy(time);

  state.pointerX += (state.targetPointerX - state.pointerX) * 0.045;
  state.pointerY += (state.targetPointerY - state.pointerY) * 0.045;

  hctx.clearRect(0, 0, width, height);
  hctx.globalCompositeOperation = "lighter";

  const breathingScale =
    1 + Math.sin(time * 0.76) * 0.012 + energy * 0.018;

  hctx.save();
  hctx.translate(cx, cy);
  hctx.scale(breathingScale, breathingScale);
  hctx.translate(-cx, -cy);

  drawEnergySweep(cx, cy, radius, time, energy);
  drawRadialSpokes(cx, cy, radius, time, energy);
  drawOrbitEllipses(cx, cy, radius, time, energy);

  drawConcentricRing(cx, cy, radius * 0.22, time * 0.29, 12, 0.58 + energy * 0.2, 1.55, [], 0.08, energy);
  drawConcentricRing(cx, cy, radius * 0.34, -time * 0.17, 18, 0.44 + energy * 0.18, 1.15, [5, 9], -0.06, energy);
  drawConcentricRing(cx, cy, radius * 0.47, time * 0.11, 26, 0.36 + energy * 0.17, 0.92, [], 0.15, energy);
  drawConcentricRing(cx, cy, radius * 0.61, -time * 0.068, 34, 0.29 + energy * 0.14, 0.82, [2, 7], -0.14, energy);
  drawConcentricRing(cx, cy, radius * 0.76, time * 0.042, 42, 0.24 + energy * 0.13, 0.7, [], 0.09, energy);
  drawConcentricRing(cx, cy, radius * 0.91, -time * 0.029, 50, 0.18 + energy * 0.1, 0.6, [9, 15], -0.08, energy);
  drawConcentricRing(cx, cy, radius * 1.08, time * 0.018, 58, 0.12 + energy * 0.08, 0.5, [3, 12], 0.04, energy);

  drawArcs(cx, cy, time, energy);
  drawFilaments(cx, cy, radius, time, energy);
  drawVoiceMembrane(cx, cy, radius, time, energy);
  drawParticles(cx, cy, radius, time, energy);
  drawCore(cx, cy, radius, time, energy);

  maybeSpawnSpark(cx, cy, radius, energy);
  drawSparks();

  hctx.restore();
  hctx.globalCompositeOperation = "source-over";

  if (state.mode === "listening") {
    const pulse = 0.12 + energy * 0.5;
    hctx.strokeStyle = `rgba(255, 198, 73, ${pulse})`;
    hctx.lineWidth = 1.15 + energy * 1.3;
    hctx.shadowColor = "#ffad16";
    hctx.shadowBlur = 16 + energy * 22;
    hctx.beginPath();
    hctx.arc(cx, cy, radius * (1.14 + energy * 0.075), 0, TAU);
    hctx.stroke();
    hctx.shadowBlur = 0;
  }

  requestAnimationFrame(drawHologram);
}

function drawLoop(time) {
  drawStars(time / 1000);
  requestAnimationFrame(drawLoop);
}

async function initAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  state.micStream = stream;
  state.audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const source = state.audioContext.createMediaStreamSource(stream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 1024;
  state.micArray = new Uint8Array(state.analyser.fftSize);
  source.connect(state.analyser);
}

function loadVoices() {
  const voices = speechSynthesis.getVoices() || [];
  const preferredMatchers = [
    (voice) =>
      /en-GB/i.test(voice.lang) &&
      /(daniel|george|ryan|arthur|male)/i.test(voice.name),
    (voice) => /en-GB/i.test(voice.lang),
    (voice) =>
      /en-US/i.test(voice.lang) &&
      /(male|david|guy|roger)/i.test(voice.name),
    (voice) => /en/i.test(voice.lang)
  ];

  for (const matcher of preferredMatchers) {
    const found = voices.find(matcher);
    if (found) {
      state.voice = found;
      return;
    }
  }

  state.voice = voices[0] || null;
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function startRecognition() {
  if (!state.recognition || state.recognizing || state.speaking) return;

  try {
    state.recognition.start();
  } catch {
    // Chrome can throw when recognition start calls overlap.
  }
}

function stopRecognition() {
  if (!state.recognition || !state.recognizing) return;
  state.recognition.stop();
}

function speak(text) {
  return new Promise((resolve) => {
    speechSynthesis.cancel();
    state.speaking = true;
    setMode("speaking");

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = state.voice || null;
    utterance.rate = 1.01;
    utterance.pitch = 0.91;
    utterance.volume = 1;

    const finish = () => {
      state.speaking = false;
      setMode("idle");

      if (state.keepListening) {
        setTimeout(startRecognition, 250);
      }

      resolve();
    };

    utterance.onend = finish;
    utterance.onerror = finish;
    speechSynthesis.speak(utterance);
  });
}

async function sendPrompt(message) {
  state.listeningForCommand = false;
  state.thinking = true;
  setMode("thinking");
  stopRecognition();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: state.history.slice(-12)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to get assistant response.");
    }

    const reply =
      data.text?.trim() || "I'm sorry, I wasn't able to respond.";

    state.history.push({ role: "user", content: message });
    state.history.push({ role: "assistant", content: reply });
    saveHistory();

    await speak(reply);
  } catch (error) {
    console.error(error);
    await speak("I'm sorry, there was a connection problem.");
  } finally {
    state.thinking = false;
    if (!state.speaking) setMode("idle");
  }
}

function initRecognition() {
  if (!SpeechRecognition) {
    alert(
      "This browser does not support continuous speech recognition. Use Chrome on desktop or Android."
    );
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    state.recognizing = true;

    if (!state.speaking && !state.thinking && !state.listeningForCommand) {
      setMode("idle");
    }
  };

  recognition.onend = () => {
    state.recognizing = false;

    if (state.keepListening && !state.speaking) {
      setTimeout(startRecognition, 300);
    }
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
  };

  recognition.onresult = async (event) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim();

      if (event.results[i].isFinal) {
        finalTranscript += `${transcript} `;
      } else {
        interimTranscript += `${transcript} `;
      }
    }

    const finalText = finalTranscript.trim().toLowerCase();
    const interimText = interimTranscript.trim().toLowerCase();

    if (state.speaking || state.thinking) return;

    if (!state.listeningForCommand) {
      const combined = `${finalText} ${interimText}`.trim();

      if (combined.includes(state.wakePhrase)) {
        setMode("listening");

        const wakeIndex = combined.indexOf(state.wakePhrase);
        const trailingCommand = combined
          .slice(wakeIndex + state.wakePhrase.length)
          .trim();

        if (trailingCommand) {
          await sendPrompt(trailingCommand);
          return;
        }

        state.listeningForCommand = true;

        clearTimeout(window.__rogueCommandTimer);
        window.__rogueCommandTimer = setTimeout(() => {
          state.listeningForCommand = false;
          if (!state.speaking && !state.thinking) setMode("idle");
        }, 6500);
      }

      return;
    }

    if (finalText) {
      clearTimeout(window.__rogueCommandTimer);
      await sendPrompt(finalText);
    } else {
      setMode("listening");
    }
  };

  state.recognition = recognition;
}

activateBtn.addEventListener("click", async () => {
  try {
    await initAudio();
    initRecognition();

    state.keepListening = true;
    overlay.classList.add("hidden");
    setMode("idle");
    startRecognition();
  } catch (error) {
    console.error(error);
    alert("Microphone permission is required.");
  }
});

resizeAll();
requestAnimationFrame(drawLoop);
requestAnimationFrame(drawHologram);
