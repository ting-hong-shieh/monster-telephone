import { cue } from './sound.js';

const media = matchMedia('(prefers-reduced-motion: reduce)');
export let reduced = media.matches;
media.addEventListener('change', event => { reduced = event.matches; });
const tracks = new Set();
const busyGhosts = new Set();
const owners = new Map();
let activeStroke;
let ghosts = [];
let ink = null;
let lastBoil = -1;
let lastSet = -1;
let gazeUntil = 0;
let frozen = false;
let quiet = false;
let curtains, lights;
let signPaths = [];
const ease = x => .5 - Math.cos(Math.PI * Math.max(0, Math.min(1, x))) / 2;
const mix = (a, b, p) => a + (b - a) * p;

// One requestAnimationFrame clock owns body, trailing sheet, pen, set and ink.
function timeline(duration, update, readable = false) {
  return new Promise(resolve => {
    const track = { start: performance.now(), duration: reduced && !readable ? Math.min(duration, 300) : duration, update, resolve };
    tracks.add(track);
  });
}
export function hold(ms) { return timeline(ms, () => {}, true); }
export async function still(ms) { quiet = true; await hold(ms); quiet = false; }

const keyframes = [
  // time, scale x, vertical offset, rotation. Scale y is always reciprocal.
  [0, 1, 0, 0], [240, 1.14, 5, -6], [420, .91, 0, -8],
  [640, .94, -13, 11], [1020, .97, -11, 9],
  [1190, 1.1, 3, -3], [1410, .97, -2, 2], [1640, 1, 0, 0]
];
function samplePose(t) {
  const next = keyframes.findIndex(key => key[0] >= t);
  if (next <= 0) return next === 0 ? keyframes[0].slice(1) : [1, 0, 0];
  const from = keyframes[next - 1], to = keyframes[next];
  const p = ease((t - from[0]) / (to[0] - from[0]));
  return from.slice(1).map((n, i) => mix(n, to[i + 1], p));
}

// Deterministic seeking uses the same poses as playback for the frame-strip check.
export function poseGhost(element, elapsed, kind = 'whisper') {
  const body = element.querySelector('.ghost-body');
  const edge = element.querySelector('.sheet-edge');
  const face = element.querySelector('.ghost-face');
  const [sx, y, rotate] = reduced ? [1, 0, 0] : samplePose(elapsed);
  const direction = /dot|hush/.test(element.id) ? -1 : 1;
  const p = Math.max(0, Math.min(1, (elapsed - 420) / 770));
  // The lateral trip and its lift form an arc, including the return.
  const x = kind === 'draw' ? Math.sin(ease(p) * Math.PI) * 8 : Math.sin(ease(p) * Math.PI) * 12;
  body.setAttribute('transform', `translate(${55 + x * direction} ${92 + y}) rotate(${rotate * direction}) scale(${sx} ${1 / sx}) translate(-55 -92)`);
  const delayed = reduced ? 0 : samplePose(Math.max(0, elapsed - 170))[2] - rotate;
  edge?.setAttribute('transform', `rotate(${delayed * 1.5 * direction} 55 80)`);
  const towardPage = /dot|hush/.test(element.id) ? -1 : /wisp/.test(element.id) ? 0 : 1;
  face?.setAttribute('transform', `translate(${kind === 'whisper' && elapsed > 420 && elapsed < 1190 ? towardPage * 3 : 0} 0)`);
  element.dataset.pose = elapsed < 420 ? 'anticipation' : elapsed < 1190 ? 'action' : elapsed < 1640 ? 'follow-through' : 'rest';
}

export async function ghostAction(name, kind = 'whisper', duration = 1820) {
  const element = document.getElementById(`ghost-${name}`);
  if (!element) return;
  const owner = Symbol('action');
  owners.set(element, owner);
  busyGhosts.add(element);
  let sounded = false;
  const bubble = document.getElementById('whisper-bubble');
  if (kind === 'whisper') { bubble.hidden = true; bubble.querySelector('span').textContent = 'psst…'; }
  await timeline(duration, (p) => {
    poseGhost(element, reduced ? 1640 : p * 1820, kind);
    if (!sounded && p > .25) { cue(kind === 'draw' ? 'pen' : 'whisper'); sounded = true; if (kind === 'whisper') bubble.hidden = false; }
    if (kind === 'whisper') bubble.setAttribute('style', `transform:translate(${reduced ? 0 : Math.sin(ease(p) * Math.PI * 2) * -18}px,${reduced ? 0 : Math.sin(ease(p) * Math.PI) * -10}px) rotate(${8 - ease(p) * 10}deg)`);
  });
  if (kind === 'whisper') bubble.hidden = true;
  poseGhost(element, 1820, kind);
  if (owners.get(element) === owner) { busyGhosts.delete(element); owners.delete(element); }
}

function seed(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function pathTokens(d) { return d.match(/[a-df-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/ig) || []; }
const sizes = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function warp(tokens, t, index) {
  let command = 'M', slot = 0;
  return tokens.map((token, n) => {
    if (/^[a-z]$/i.test(token)) { command = token.toUpperCase(); slot = 0; return token; }
    const current = slot++ % (sizes[command] || 1);
    // Arc radii, rotation and flags are geometry, not ink coordinates.
    if (command === 'A' && current < 5) return token;
    const jitter = (seed(n + index * 97 + Math.floor(t * 12) % 3) - .5) * .58;
    const wave = Math.sin(t * 2.1 + Number(token) / 48 + index) * .7;
    return (Number(token) + wave + jitter).toFixed(2);
  }).join(' ');
}

export function setInk(svg) {
  if (!svg) { ink = null; return; }
  const paths = [...svg.querySelectorAll('path')];
  ink = { svg, paths: paths.map((path, i) => ({ path, d: path.getAttribute('d'), tokens: pathTokens(path.getAttribute('d')), i })), drawing: false };
  lastBoil = -1;
  svg.addEventListener('pointerenter', () => { gazeUntil = performance.now() + 1500; });
}

export function finishStroke() { if (activeStroke) activeStroke.start = performance.now() - activeStroke.duration; }

export async function strokeOn(svg, duration = 4000) {
  setInk(svg);
  const drawing = ink;
  drawing.drawing = true;
  const NS = 'http://www.w3.org/2000/svg';
  const pen = document.createElementNS(NS, 'g');
  pen.setAttribute('fill', '#ad173d');
  pen.setAttribute('stroke', '#292f35');
  pen.setAttribute('stroke-width', '1');
  const tip = document.createElementNS(NS, 'path');
  tip.setAttribute('d', 'M0 0 2-9 9-26 14-23 6-6Z M2-9 6-6M9-26l2-4 5 3-2 4');
  pen.append(tip);
  const entries = drawing.paths.map(({ path }, i) => {
    const length = path.getTotalLength();
    path.setAttribute('stroke-dasharray', `${length} ${length}`);
    path.setAttribute('stroke-dashoffset', length);
    return { path, length, duration: 160 + Math.min(270, length * .55) + seed(i) * 110 };
  });
  svg.append(pen);
  cue('pen', .3);
  let offset = 0;
  const total = entries.reduce((sum, e) => sum + e.duration + 60, 0);
  const animation = timeline(duration, p => {
    let time = p * total;
    for (const entry of entries) {
      // Brief mid-stroke hesitation and a readable lift between paths.
      let progress = Math.min(1, Math.max(0, time / entry.duration));
      if (progress > .42 && progress < .54) progress = .42;
      else if (progress >= .54) progress = .42 + (progress - .54) / .46 * .58;
      const amount = reduced ? (p > .5 ? 1 : 0) : ease(progress);
      entry.path.setAttribute('stroke-dashoffset', entry.length * (1 - amount));
      if (time >= 0 && time < entry.duration + 60) {
        const point = entry.path.getPointAtLength(entry.length * amount);
        pen.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(${Math.sin(p * 15) * 7})`);
      }
      time -= entry.duration + 60;
    }
    offset = p;
  });
  activeStroke = [...tracks].at(-1);
  await animation;
  activeStroke = null;
  pen.remove();
  for (const { path } of entries) { path.removeAttribute('stroke-dasharray'); path.removeAttribute('stroke-dashoffset'); }
  drawing.drawing = false;
  return offset;
}

export async function pageTurn(final = false, duration = final ? 900 : 480) {
  const paper = document.getElementById('paper-holder');
  cue('page-turn');
  await timeline(duration, p => {
    const arc = Math.sin(ease(p) * Math.PI);
    const x = reduced ? 0 : Math.sin(ease(p) * Math.PI * 2) * 13;
    const y = reduced ? 0 : -arc * (final ? 26 : 12);
    const rotate = reduced ? -5 : -5 + arc * (final ? 10 : 4);
    const sx = reduced ? 1 : 1 - arc * .035;
    paper.style.transform = `translate(${x}px,${y}px) rotate(${rotate}deg) scale(${sx},${1 / sx})`;
  });
}

export function initMotion() {
  ghosts = [...document.querySelectorAll('.ghost-art')];
  signPaths = [...document.querySelectorAll('.sign-ink path')].map((path, i) => ({ path, d: path.getAttribute('d'), tokens: pathTokens(path.getAttribute('d')), i }));
  // Isolate moving scenery so a tiny curtain breath does not repaint the stage.
  const NS = 'http://www.w3.org/2000/svg';
  const set = document.querySelector('.set-art');
  curtains = ['left', 'right'].map(side => {
    const layer = document.createElementNS(NS, 'svg');
    layer.setAttribute('viewBox', side === 'left' ? '0 0 170 375' : '510 0 170 375');
    layer.setAttribute('preserveAspectRatio', 'none');
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('class', `curtain-motion curtain-motion-${side}`);
    layer.append(document.querySelector(`.curtain-${side}`));
    set.before(layer);
    return layer;
  });
  const footlightLayer = document.createElementNS(NS, 'svg');
  footlightLayer.setAttribute('viewBox', '0 440 680 70');
  footlightLayer.setAttribute('preserveAspectRatio', 'none');
  footlightLayer.setAttribute('aria-hidden', 'true');
  footlightLayer.setAttribute('class', 'footlight-motion');
  footlightLayer.append(document.querySelector('.footlights'));
  set.after(footlightLayer);
  lights = document.querySelector('.light-ray');
  let last = performance.now();
  function frame(now) {
    const delta = now - last;
    last = now;
    if (!document.hidden) {
      for (const track of tracks) {
        if (frozen) { track.start += delta; continue; }
        const elapsed = now - track.start;
        const p = Math.min(1, elapsed / track.duration);
        track.update(p, reduced ? p * track.duration : elapsed);
        if (p >= 1) { tracks.delete(track); track.resolve(); }
      }
      if (!frozen) ambient(now);
    } else for (const track of tracks) track.start += delta;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (!reduced) ghosts.forEach((element, i) => {
    const owner = Symbol('entrance');
    owners.set(element, owner); busyGhosts.add(element);
    timeline(1350 + i * 90, (_, elapsed) => {
      if (owners.get(element) !== owner) return;
      const p = Math.max(0, Math.min(1, (elapsed - i * 90) / 1300));
      const arrival = ease(Math.min(1, p / .65));
      const sx = p < .65 ? mix(.88, 1.13, arrival) : mix(1.13, 1, ease((p - .65) / .35));
      const x = (i % 2 ? -1 : 1) * (1 - arrival) * 22;
      const y = (1 - arrival) * 20 - Math.sin(arrival * Math.PI) * 15;
      element.querySelector('.ghost-body').setAttribute('transform', `translate(${55 + x} ${92 + y}) rotate(${(1 - arrival) * 9}) scale(${sx} ${1 / sx}) translate(-55 -92)`);
      element.querySelector('.sheet-edge')?.setAttribute('transform', `rotate(${Math.sin(p * Math.PI * 2) * (1 - p) * 12} 55 80)`);
    }).then(() => { if (owners.get(element) === owner) { busyGhosts.delete(element); owners.delete(element); } });
  });
}

function ambient(now) {
  if (quiet) return;
  const t = now / 1000;
  const tick = Math.floor(now / (1000 / 12));
  const secondary = tick !== lastSet;
  ghosts.forEach((element, i) => {
    if (busyGhosts.has(element)) return;
    const edge = element.querySelector('.sheet-edge');
    const face = element.querySelector('.ghost-face');
    const breath = reduced ? 0 : Math.sin(t * 1.5 + i * 1.8);
    const sx = 1 + breath * .018;
    element.style.transform = `translateY(${breath * 1.6}px) rotate(${reduced ? 0 : Math.sin(t + i) * 1.5}deg) scale(${sx},${1 / sx})`;
    if (secondary) {
      edge?.setAttribute('transform', `rotate(${reduced ? 0 : Math.sin(t * 1.5 + i * 1.8 - .7) * 3} 55 80)`);
      const towardPage = /dot|hush/.test(element.id) ? -1 : /wisp/.test(element.id) ? 0 : 1;
      face?.setAttribute('transform', `translate(${reduced ? 0 : (1 + Math.sin(t * .6 + i)) * towardPage * 1.1} 0)`);
    }
  });
  if (secondary) {
    lastSet = tick;
    for (const { path, d, tokens, i } of signPaths) path.setAttribute('d', reduced ? d : warp(tokens, t, i));
    curtains?.forEach(element => { element.style.transform = `scaleX(${1 + (reduced ? 0 : Math.sin(t * .9) * .008)})`; });
    lights?.setAttribute('opacity', reduced ? '.7' : String(.62 + Math.sin(t * 4.1) * .13 + Math.sin(t * 7) * .08));
  }
  if (!ink || ink.drawing || !ink.svg.isConnected) return;
  if (tick === lastBoil) return;
  lastBoil = tick;
  const looked = !reduced && now < gazeUntil;
  const breath = reduced ? 0 : Math.sin(t * 1.9) * .012;
  const sx = 1 + breath + (looked ? Math.sin(ease((gazeUntil - now) / 1500) * Math.PI) * .045 : 0);
  ink.svg.setAttribute('style', `transform:rotate(${reduced ? 0 : Math.sin(t * 1.2) * .5}deg) scale(${sx},${1 / sx});transform-origin:50% 70%`);
  for (const { path, d, tokens, i } of ink.paths) path.setAttribute('d', reduced ? d : warp(tokens, t, i));
}

// Freeze the shared clock only for deterministic, inspectable capture frames.
export function freeze(value) { frozen = value; }
