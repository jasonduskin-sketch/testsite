const activateBtn = document.getElementById("activateBtn");
const overlay = document.getElementById("activationOverlay");
const hologramCanvas = document.getElementById("hologram");
const starfieldCanvas = document.getElementById("starfield");
const hctx = hologramCanvas.getContext("2d");
const sctx = starfieldCanvas.getContext("2d");

const videoOverlay = document.getElementById("videoOverlay");
const videoTitle = document.getElementById("videoTitle");
const videoChannel = document.getElementById("videoChannel");
const videoStatus = document.getElementById("videoStatus");
const closeVideoBtn = document.getElementById("closeVideoBtn");
const manualPlayBtn = document.getElementById("manualPlayBtn");
const jarvisVoiceAudio =
  document.getElementById("jarvisVoiceAudio");
const enableJarvisVoiceBtn =
  document.getElementById("enableJarvisVoiceBtn");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const TAU = Math.PI * 2;

const state = {
  mode: "idle",
  wakePhrases: ["jarvis", "hey jarvis", "okay jarvis", "ok jarvis"],
  sessionActive: false,
  sessionTimer: null,
  sessionExpiresAt: 0,
  recognition: null,
  keepListening: false,
  recognizing: false,
  speaking: false,
  thinking: false,
  audioContext: null,
  analyser: null,
  micArray: null,
  micStream: null,
  voice: null,
  lastVoiceEnergy: 0,
  history: JSON.parse(localStorage.getItem("jarvis_voice_history") || "[]"),
  particles: [],
  stars: [],
  arcs: [],
  sparks: [],
  filaments: [],
  pointerX: 0,
  pointerY: 0,
  targetPointerX: 0,
  targetPointerY: 0,
  lastFrame: performance.now(),
  youtubeApiReady: false,
  youtubePlayer: null,
  youtubePlayerReady: false,
  youtubePlayerResolvers: [],
  pendingVideo: null,
  videoOverlayOpen: false,
  videoPlaying: false,
  videoShouldResumeAfterSpeech: false,
  youtubeResults: [],
  youtubeResultIndex: 0,
  currentVideoTitle: "",
  currentVideoChannel: "",
  jarvisVoiceUnlocked: false,
  jarvisVoiceObjectUrl: null,
  pendingJarvisVoiceUrl: null,
  pendingJarvisVoiceResolve: null
};

function setMode(mode) {
  state.mode = mode;
  document.body.dataset.state = mode;
}

function saveHistory() {
  localStorage.setItem(
    "jarvis_voice_history",
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


function decodeHtmlEntities(text) {
  const documentFragment = new DOMParser().parseFromString(
    String(text || ""),
    "text/html"
  );

  return documentFragment.documentElement.textContent || "";
}

function setVideoStatus(message) {
  videoStatus.textContent = String(message || "").toUpperCase();
}

function openVideoOverlay() {
  state.videoOverlayOpen = true;
  videoOverlay.classList.add("open");
  videoOverlay.setAttribute("aria-hidden", "false");
}

function closeVideoOverlay() {
  state.videoOverlayOpen = false;
  state.videoPlaying = false;
  state.videoShouldResumeAfterSpeech = false;

  if (state.youtubePlayerReady) {
    state.youtubePlayer.stopVideo();
  }

  videoOverlay.classList.remove("open");
  videoOverlay.setAttribute("aria-hidden", "true");
  manualPlayBtn.hidden = true;
  setVideoStatus("Closed");
}

function resolveYouTubePlayerWaiters() {
  const resolvers = state.youtubePlayerResolvers.splice(0);

  for (const resolve of resolvers) {
    resolve(state.youtubePlayer);
  }
}

function createYouTubePlayer() {
  if (
    !state.youtubeApiReady ||
    state.youtubePlayer ||
    !state.pendingVideo
  ) {
    return;
  }

  state.youtubePlayer = new YT.Player("youtubePlayer", {
    width: "100%",
    height: "100%",
    videoId: state.pendingVideo.videoId,
    playerVars: {
      autoplay: 0,
      controls: 1,
      playsinline: 1,
      rel: 0,
      origin: window.location.origin
    },
    events: {
      onReady(event) {
        state.youtubePlayerReady = true;
        event.target.setVolume(55);

        if (state.pendingVideo?.videoId) {
          event.target.cueVideoById(state.pendingVideo.videoId);
        }

        setVideoStatus("Ready");
        resolveYouTubePlayerWaiters();
      },

      onStateChange(event) {
        if (!window.YT?.PlayerState) return;

        state.videoPlaying =
          event.data === YT.PlayerState.PLAYING;

        if (event.data === YT.PlayerState.PLAYING) {
          manualPlayBtn.hidden = true;
          setVideoStatus("Playing");
        } else if (event.data === YT.PlayerState.PAUSED) {
          setVideoStatus("Paused");
        } else if (event.data === YT.PlayerState.BUFFERING) {
          setVideoStatus("Buffering");
        } else if (event.data === YT.PlayerState.ENDED) {
          setVideoStatus("Ended");
        }
      },

      onAutoplayBlocked() {
        manualPlayBtn.hidden = false;
        setVideoStatus("Press play");
      },

      onError(event) {
        console.error("YouTube player error:", event.data);
        setVideoStatus("Playback error");
        manualPlayBtn.hidden = false;
      }
    }
  });
}

window.onYouTubeIframeAPIReady = () => {
  state.youtubeApiReady = true;
  createYouTubePlayer();
};

function waitForYouTubePlayer() {
  if (state.youtubePlayerReady) {
    return Promise.resolve(state.youtubePlayer);
  }

  createYouTubePlayer();

  return new Promise((resolve, reject) => {
    state.youtubePlayerResolvers.push(resolve);

    setTimeout(() => {
      if (!state.youtubePlayerReady) {
        reject(new Error("The YouTube player did not load."));
      }
    }, 12000);
  });
}

async function displayYouTubeVideo(result, autoplay = false) {
  state.pendingVideo = result;
  state.currentVideoTitle = decodeHtmlEntities(result.title);
  state.currentVideoChannel = decodeHtmlEntities(result.channelTitle);
  state.videoShouldResumeAfterSpeech = false;

  videoTitle.textContent = state.currentVideoTitle;
  videoChannel.textContent = state.currentVideoChannel;
  manualPlayBtn.hidden = true;
  setVideoStatus("Loading");
  openVideoOverlay();

  createYouTubePlayer();

  const player = await waitForYouTubePlayer();

  if (autoplay) {
    player.loadVideoById(result.videoId);
  } else {
    player.cueVideoById(result.videoId);
  }
}

function pauseVideoForVoice(autoResume = true) {
  if (!state.youtubePlayerReady || !state.videoPlaying) {
    state.videoShouldResumeAfterSpeech = false;
    return false;
  }

  state.youtubePlayer.pauseVideo();
  state.videoShouldResumeAfterSpeech = autoResume;
  return true;
}

function preventVideoAutoResume() {
  state.videoShouldResumeAfterSpeech = false;
}

function getPlayerVolume() {
  if (!state.youtubePlayerReady) return 55;
  return state.youtubePlayer.getVolume();
}

async function searchYouTube(query) {
  setVideoStatus("Searching");

  const response = await fetch("/api/youtube", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });

  const rawResponse = await response.text();
  let data;

  try {
    data = JSON.parse(rawResponse);
  } catch {
    throw new Error(
      `YouTube search returned ${response.status}: ${rawResponse.slice(0, 120)}`
    );
  }

  if (!response.ok) {
    throw new Error(data.error || "YouTube search failed.");
  }

  return data.results || [];
}

function extractYouTubeQuery(text) {
  let normalized = normalizeSpeech(text);

  if (!normalized) return "";

  // Remove polite conversational filler so natural requests still route
  // to the YouTube player rather than being sent to Gemini.
  normalized = normalized
    .replace(
      /^(?:please |could you |can you |would you |will you |i want you to |i would like you to |i'd like you to |let me |go ahead and )+/,
      ""
    )
    .replace(/\b(?:please|for me)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const explicitPatterns = [
    /^(?:play|show|open|find|search for|put on|watch) (.+?) on youtube$/,
    /^(?:play|show|open|find|search for|put on|watch) youtube (.+)$/,
    /^youtube (?:play|show|open|find|search for) (.+)$/,
    /^search youtube (?:for )?(.+)$/,
    /^find (.+?) (?:on|from) youtube$/,
    /^(?:play|show|open|put on) (?:a |the )?youtube video (?:for |of |about )?(.+)$/,
    /^(?:i want to watch|i would like to watch|i'd like to watch) (.+?)(?: on youtube)?$/,
    /^(?:show me|play me) (.+?)(?: on youtube)?$/
  ];

  for (const pattern of explicitPatterns) {
    const match = normalized.match(pattern);

    if (match?.[1]) {
      return match[1]
        .replace(/\b(?:video|music video)\b$/g, "")
        .trim();
    }
  }

  // If the user clearly mentions YouTube, remove the command words and
  // use what remains as the search query.
  if (normalized.includes("youtube")) {
    const query = normalized
      .replace(/\byoutube\b/g, " ")
      .replace(
        /^(?:play|show|open|find|search|search for|put on|watch|look up)\s+/,
        ""
      )
      .replace(/\b(?:on|from)\b\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (query) return query;
  }

  // During an open JARVIS session, common media phrasing such as
  // "put on Johnny Cash Hurt" should also be treated as YouTube.
  const implicitPatterns = [
    /^(?:put on|show me|play me|watch) (.+)$/,
    /^play (?:the |a )?(?:video|music video|trailer|clip) (?:for |of |about )?(.+)$/,
    /^play (.+?) (?:video|music video|trailer|clip)$/
  ];

  for (const pattern of implicitPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}
function parseNumberFromSpeech(text, fallback) {
  const digitMatch = String(text).match(/\b(\d{1,3})\b/);
  if (digitMatch) return Number(digitMatch[1]);

  const words = {
    one: 1,
    two: 2,
    three: 3,
    five: 5,
    ten: 10,
    fifteen: 15,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    ninety: 90
  };

  for (const [word, value] of Object.entries(words)) {
    if (String(text).includes(word)) return value;
  }

  return fallback;
}

async function playYouTubeSearch(query) {
  preventVideoAutoResume();
  state.thinking = true;
  setMode("thinking");
  stopRecognition();

  try {
    const results = await searchYouTube(query);

    state.youtubeResults = results;
    state.youtubeResultIndex = 0;

    const result = results[0];
    await displayYouTubeVideo(result, false);
    await speak(`Playing ${decodeHtmlEntities(result.title)}.`);
    state.youtubePlayer.playVideo();
  } catch (error) {
    console.error("YouTube search error:", error);
    setVideoStatus("Search error");
    await speak(
      "I recognized that as a YouTube request, but the YouTube search or player failed. Please check the YouTube API route."
    );
  } finally {
    state.thinking = false;

    if (!state.speaking) {
      setMode(state.sessionActive ? "listening" : "idle");
    }
  }
}

async function playAdjacentYouTubeResult(direction) {
  if (!state.youtubeResults.length) {
    await speak("There isn't another search result queued.");
    return;
  }

  preventVideoAutoResume();

  const resultCount = state.youtubeResults.length;
  state.youtubeResultIndex =
    (state.youtubeResultIndex + direction + resultCount) %
    resultCount;

  const result = state.youtubeResults[state.youtubeResultIndex];

  await displayYouTubeVideo(result, false);
  await speak(`Playing ${decodeHtmlEntities(result.title)}.`);
  state.youtubePlayer.playVideo();
}

async function handleYouTubeCommand(text) {
  const normalized = normalizeSpeech(text);
  const query = extractYouTubeQuery(normalized);

  console.info("JARVIS command heard:", normalized);

  if (query) {
    console.info("Routing command to YouTube search:", query);
    await playYouTubeSearch(query);
    return true;
  }

  if (
    /^(pause|hold|freeze)( the)?( youtube)? video$/.test(normalized) ||
    normalized === "pause it"
  ) {
    preventVideoAutoResume();

    if (state.youtubePlayerReady) {
      state.youtubePlayer.pauseVideo();
      await speak("Paused.");
    } else {
      await speak("There isn't a video open.");
    }

    return true;
  }

  if (
    /^(resume|continue)( the)?( youtube)? video$/.test(normalized) ||
    normalized === "resume" ||
    normalized === "continue" ||
    normalized === "play the video" ||
    normalized === "play video"
  ) {
    preventVideoAutoResume();

    if (state.youtubePlayerReady && state.videoOverlayOpen) {
      await speak("Resuming.");
      state.youtubePlayer.playVideo();
    } else {
      await speak("There isn't a video open.");
    }

    return true;
  }

  if (
    /^(close|hide|stop)( the)?( youtube)? video$/.test(normalized) ||
    normalized === "close youtube" ||
    normalized === "stop youtube"
  ) {
    preventVideoAutoResume();

    if (state.videoOverlayOpen) {
      closeVideoOverlay();
      await speak("Video closed.");
    } else {
      await speak("There isn't a video open.");
    }

    return true;
  }

  if (
    normalized === "mute video" ||
    normalized === "mute the video" ||
    normalized === "mute it"
  ) {
    preventVideoAutoResume();

    if (state.youtubePlayerReady) {
      state.youtubePlayer.mute();
      await speak("Muted.");
    } else {
      await speak("There isn't a video open.");
    }

    return true;
  }

  if (
    normalized === "unmute video" ||
    normalized === "unmute the video" ||
    normalized === "unmute it"
  ) {
    if (state.youtubePlayerReady) {
      state.youtubePlayer.unMute();
      await speak("Unmuted.");
    } else {
      preventVideoAutoResume();
      await speak("There isn't a video open.");
    }

    return true;
  }

  if (
    normalized.includes("volume up") ||
    normalized.includes("turn it up") ||
    normalized === "louder"
  ) {
    if (state.youtubePlayerReady) {
      const volume = Math.min(100, getPlayerVolume() + 10);
      state.youtubePlayer.setVolume(volume);
      await speak(`Volume ${volume} percent.`);
    } else {
      preventVideoAutoResume();
      await speak("There isn't a video open.");
    }

    return true;
  }

  if (
    normalized.includes("volume down") ||
    normalized.includes("turn it down") ||
    normalized === "quieter"
  ) {
    if (state.youtubePlayerReady) {
      const volume = Math.max(0, getPlayerVolume() - 10);
      state.youtubePlayer.setVolume(volume);
      await speak(`Volume ${volume} percent.`);
    } else {
      preventVideoAutoResume();
      await speak("There isn't a video open.");
    }

    return true;
  }

  if (
    normalized.includes("set volume") ||
    normalized.includes("volume to")
  ) {
    if (state.youtubePlayerReady) {
      const volume = Math.max(
        0,
        Math.min(100, parseNumberFromSpeech(normalized, 50))
      );

      state.youtubePlayer.setVolume(volume);
      await speak(`Volume ${volume} percent.`);
    } else {
      preventVideoAutoResume();
      await speak("There isn't a video open.");
    }

    return true;
  }

  if (
    normalized.includes("skip ahead") ||
    normalized.includes("fast forward")
  ) {
    if (state.youtubePlayerReady) {
      const seconds = parseNumberFromSpeech(normalized, 30);
      const nextTime =
        state.youtubePlayer.getCurrentTime() + seconds;

      state.youtubePlayer.seekTo(nextTime, true);
      await speak(`Skipping ahead ${seconds} seconds.`);
    } else {
      preventVideoAutoResume();
      await speak("There isn't a video open.");
    }

    return true;
  }

  if (
    normalized.includes("go back") ||
    normalized.includes("rewind")
  ) {
    if (state.youtubePlayerReady) {
      const seconds = parseNumberFromSpeech(normalized, 10);
      const nextTime = Math.max(
        0,
        state.youtubePlayer.getCurrentTime() - seconds
      );

      state.youtubePlayer.seekTo(nextTime, true);
      await speak(`Going back ${seconds} seconds.`);
    } else {
      preventVideoAutoResume();
      await speak("There isn't a video open.");
    }

    return true;
  }

  if (
    normalized === "next video" ||
    normalized === "play the next video"
  ) {
    await playAdjacentYouTubeResult(1);
    return true;
  }

  if (
    normalized === "previous video" ||
    normalized === "play the previous video"
  ) {
    await playAdjacentYouTubeResult(-1);
    return true;
  }

  return false;
}

closeVideoBtn.addEventListener("click", () => {
  closeVideoOverlay();
});

manualPlayBtn.addEventListener("click", () => {
  manualPlayBtn.hidden = true;

  if (state.youtubePlayerReady) {
    state.youtubePlayer.playVideo();
  }
});


function createSilentWavBlob(durationMs = 120) {
  const sampleRate = 8000;
  const sampleCount = Math.max(
    1,
    Math.floor((sampleRate * durationMs) / 1000)
  );
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);

  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 2, true);

  return new Blob([buffer], { type: "audio/wav" });
}

async function unlockJarvisVoice() {
  try {
    const silentUrl = URL.createObjectURL(createSilentWavBlob());

    jarvisVoiceAudio.src = silentUrl;
    jarvisVoiceAudio.volume = 1;
    jarvisVoiceAudio.muted = false;

    await jarvisVoiceAudio.play();
    jarvisVoiceAudio.pause();
    jarvisVoiceAudio.currentTime = 0;

    URL.revokeObjectURL(silentUrl);

    state.jarvisVoiceUnlocked = true;
    enableJarvisVoiceBtn.hidden = true;

    console.info("JARVIS cloud voice audio unlocked.");
    return true;
  } catch (error) {
    console.warn("JARVIS audio unlock was blocked:", error);
    state.jarvisVoiceUnlocked = false;
    enableJarvisVoiceBtn.hidden = false;
    return false;
  }
}

function finishJarvisSpeech(resolve) {
  state.speaking = false;

  if (state.jarvisVoiceObjectUrl) {
    URL.revokeObjectURL(state.jarvisVoiceObjectUrl);
    state.jarvisVoiceObjectUrl = null;
  }

  if (state.sessionActive) {
    resetSessionTimer();
    setMode("listening");
  } else {
    setMode("idle");
  }

  if (
    state.videoShouldResumeAfterSpeech &&
    state.youtubePlayerReady &&
    state.videoOverlayOpen
  ) {
    state.videoShouldResumeAfterSpeech = false;
    state.youtubePlayer.playVideo();
  }

  if (state.keepListening) {
    setTimeout(startRecognition, 250);
  }

  resolve();
}

function fallbackBrowserSpeech(text) {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = state.voice || null;
    utterance.rate = 0.95;
    utterance.pitch = 0.88;
    utterance.volume = 1;

    utterance.onend = resolve;
    utterance.onerror = resolve;

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  });
}

async function fetchJarvisSpeech(text) {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const rawError = await response.text();
    let message = rawError;

    try {
      message = JSON.parse(rawError)?.error || rawError;
    } catch {
      // Keep raw server text.
    }

    throw new Error(
      message || `JARVIS TTS failed with status ${response.status}.`
    );
  }

  return response.blob();
}

async function playJarvisSpeechBlob(blob) {
  if (state.jarvisVoiceObjectUrl) {
    URL.revokeObjectURL(state.jarvisVoiceObjectUrl);
  }

  const objectUrl = URL.createObjectURL(blob);
  state.jarvisVoiceObjectUrl = objectUrl;
  state.pendingJarvisVoiceUrl = objectUrl;

  jarvisVoiceAudio.pause();
  jarvisVoiceAudio.src = objectUrl;
  jarvisVoiceAudio.currentTime = 0;
  jarvisVoiceAudio.volume = 1;
  jarvisVoiceAudio.muted = false;

  await jarvisVoiceAudio.play();

  state.jarvisVoiceUnlocked = true;
  state.pendingJarvisVoiceUrl = null;
  enableJarvisVoiceBtn.hidden = true;
}

enableJarvisVoiceBtn.addEventListener("click", async () => {
  try {
    if (state.pendingJarvisVoiceUrl) {
      jarvisVoiceAudio.src = state.pendingJarvisVoiceUrl;
      jarvisVoiceAudio.volume = 1;
      jarvisVoiceAudio.muted = false;
      await jarvisVoiceAudio.play();
      state.jarvisVoiceUnlocked = true;
      enableJarvisVoiceBtn.hidden = true;
      return;
    }

    await unlockJarvisVoice();
  } catch (error) {
    console.error("JARVIS voice enable failed:", error);
    enableJarvisVoiceBtn.hidden = false;
  }
});

function loadVoices() {
  const voices = speechSynthesis.getVoices() || [];

  if (!voices.length) {
    state.voice = null;
    return;
  }

  // Prefer polished British English voices commonly available
  // through Windows, macOS, Android, and Chromium.
  const preferredNames = [
    "Microsoft Ryan Online (Natural) - English (United Kingdom)",
    "Microsoft Ryan - English (United Kingdom)",
    "Microsoft George - English (United Kingdom)",
    "Microsoft Thomas - English (United Kingdom)",
    "Daniel",
    "Arthur",
    "Oliver",
    "George",
    "Ryan",
    "Google UK English Male",
    "English United Kingdom"
  ];

  for (const preferredName of preferredNames) {
    const exactMatch = voices.find(
      (voice) =>
        voice.name.toLowerCase() === preferredName.toLowerCase()
    );

    if (exactMatch) {
      state.voice = exactMatch;
      console.info(
        "JARVIS voice selected:",
        exactMatch.name,
        exactMatch.lang
      );
      return;
    }
  }

  const rankedVoices = voices
    .map((voice) => {
      const name = voice.name.toLowerCase();
      const lang = voice.lang.toLowerCase();
      let score = 0;

      if (lang === "en-gb") score += 100;
      else if (lang.startsWith("en-gb")) score += 95;
      else if (lang.startsWith("en")) score += 35;

      if (name.includes("natural")) score += 35;
      if (name.includes("online")) score += 20;
      if (name.includes("neural")) score += 20;

      if (
        /(ryan|george|daniel|arthur|oliver|thomas|male)/i.test(
          voice.name
        )
      ) {
        score += 30;
      }

      if (
        /(female|susan|hazel|sonia|libby|molly|serena)/i.test(
          voice.name
        )
      ) {
        score -= 25;
      }

      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);

  state.voice = rankedVoices[0]?.voice || voices[0] || null;

  if (state.voice) {
    console.info(
      "JARVIS voice selected:",
      state.voice.name,
      state.voice.lang
    );
  }
}
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

const SESSION_TIMEOUT_MS = 3 * 60 * 1000;

function normalizeSpeech(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findWakePhrase(text) {
  const normalized = normalizeSpeech(text);

  for (const phrase of state.wakePhrases) {
    const index = normalized.indexOf(phrase);
    if (index !== -1) {
      return { phrase, index, normalized };
    }
  }

  return null;
}

function resetSessionTimer() {
  clearTimeout(state.sessionTimer);
  state.sessionExpiresAt = Date.now() + SESSION_TIMEOUT_MS;

  state.sessionTimer = setTimeout(() => {
    endConversationSession(false);
  }, SESSION_TIMEOUT_MS);
}

function beginConversationSession() {
  state.sessionActive = true;
  resetSessionTimer();

  if (!state.speaking && !state.thinking) {
    setMode("listening");
  }
}

function endConversationSession(announce = false) {
  const wasActive = state.sessionActive;

  state.sessionActive = false;
  state.sessionExpiresAt = 0;
  clearTimeout(state.sessionTimer);
  state.sessionTimer = null;

  if (!state.speaking && !state.thinking) {
    setMode("idle");
  }

  if (announce && wasActive) {
    speak("Going quiet.");
  }
}

function isSleepCommand(text) {
  const normalized = normalizeSpeech(text);

  return [
    "go to sleep",
    "stop listening",
    "that is all",
    "that's all",
    "dismiss",
    "stand by",
    "standby"
  ].some((command) => normalized === command || normalized.endsWith(command));
}

function stripWakePhrase(text) {
  const wake = findWakePhrase(text);
  if (!wake) return normalizeSpeech(text);

  return wake.normalized
    .slice(wake.index + wake.phrase.length)
    .trim();
}

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
  return new Promise(async (resolve) => {
    speechSynthesis.cancel();
    stopRecognition();

    jarvisVoiceAudio.pause();
    jarvisVoiceAudio.currentTime = 0;

    state.speaking = true;
    setMode("speaking");

    const finish = () => finishJarvisSpeech(resolve);

    jarvisVoiceAudio.onended = finish;
    jarvisVoiceAudio.onerror = async (event) => {
      console.error("JARVIS audio playback error:", event);

      try {
        await fallbackBrowserSpeech(text);
      } finally {
        finish();
      }
    };

    try {
      const audioBlob = await fetchJarvisSpeech(text);
      await playJarvisSpeechBlob(audioBlob);
    } catch (error) {
      console.error("JARVIS cloud speech failed:", error);

      // If the browser blocks the generated audio, keep the audio URL
      // ready and show a one-tap phone fallback.
      if (
        error?.name === "NotAllowedError" &&
        state.jarvisVoiceObjectUrl
      ) {
        state.pendingJarvisVoiceUrl =
          state.jarvisVoiceObjectUrl;
        enableJarvisVoiceBtn.hidden = false;
        return;
      }

      try {
        await fallbackBrowserSpeech(text);
      } finally {
        finish();
      }
    }
  });
}

async function sendPrompt(message) {
  const cleanMessage = normalizeSpeech(message);
  if (!cleanMessage) return;

  beginConversationSession();
  state.thinking = true;
  setMode("thinking");
  stopRecognition();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: cleanMessage,
        history: state.history.slice(-12)
      })
    });

    const rawResponse = await response.text();
    let data;

    try {
      data = JSON.parse(rawResponse);
    } catch {
      throw new Error(
        `The intelligence service returned ${response.status}: ${rawResponse.slice(0, 120)}`
      );
    }

    if (!response.ok) {
      throw new Error(data.error || "Failed to get assistant response.");
    }

    const reply =
      data.text?.trim() || "I'm sorry, I wasn't able to respond.";

    state.history.push({ role: "user", content: cleanMessage });
    state.history.push({ role: "assistant", content: reply });
    saveHistory();

    resetSessionTimer();
    await speak(reply);
  } catch (error) {
    console.error("JARVIS assistant error:", error);
    await speak(
      "I'm sorry, I couldn't reach the intelligence service. Please check the Vercel API configuration."
    );
  } finally {
    state.thinking = false;

    if (!state.speaking) {
      setMode(state.sessionActive ? "listening" : "idle");
    }
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

    if (!state.speaking && !state.thinking) {
      setMode(state.sessionActive ? "listening" : "idle");
    }
  };

  recognition.onend = () => {
    state.recognizing = false;

    if (state.keepListening && !state.speaking) {
      setTimeout(startRecognition, 300);
    }
  };

  recognition.onerror = (event) => {
    // "no-speech" is normal during quiet periods. Chrome restarts automatically.
    if (event.error !== "no-speech") {
      console.warn("Speech recognition error:", event.error);
    }
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

    const finalText = normalizeSpeech(finalTranscript);
    const interimText = normalizeSpeech(interimTranscript);

    if (state.speaking || state.thinking) return;

    if (!state.sessionActive) {
      if (!finalText) return;

      const wake = findWakePhrase(finalText);
      if (!wake) return;

      beginConversationSession();

      const trailingCommand = stripWakePhrase(finalText);

      if (trailingCommand) {
        pauseVideoForVoice(true);

        const handledByYouTube =
          await handleYouTubeCommand(trailingCommand);

        if (!handledByYouTube) {
          await sendPrompt(trailingCommand);
        }
      } else {
        pauseVideoForVoice(false);
        await speak("At your service.");
      }

      return;
    }

    // During the three-minute session, every completed sentence is a command.
    if (finalText) {
      resetSessionTimer();

      if (isSleepCommand(finalText)) {
        endConversationSession(true);
        return;
      }

      const command = stripWakePhrase(finalText);

      // Ignore the wake phrase if the user repeats it by itself.
      if (!command && findWakePhrase(finalText)) {
        pauseVideoForVoice(false);
        setMode("listening");
        return;
      }

      pauseVideoForVoice(true);

      const spokenCommand = command || finalText;
      const handledByYouTube =
        await handleYouTubeCommand(spokenCommand);

      if (!handledByYouTube) {
        await sendPrompt(spokenCommand);
      }

      return;
    }

    if (interimText) {
      setMode("listening");
    }
  };

  state.recognition = recognition;
}

activateBtn.addEventListener("click", async () => {
  try {
    await initAudio();
    await unlockJarvisVoice();
    initRecognition();

    state.keepListening = true;
    state.sessionActive = false;
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
