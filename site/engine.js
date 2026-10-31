export const LIVE_TIMEOUT = 20000;
const API = ['localhost', '127.0.0.1'].includes(location.hostname) ? '' : 'https://monster-telephone-ghosts.onrender.com';
const WAKE_LIMIT = 80000;
const mode = new URLSearchParams(location.search).get('mode') === 'recorded' ? 'recorded' : 'live';
export function getMode() { return mode; }
let recordings;
export function loadRecordings() {
  recordings ??= fetch(new URL('data/chains.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error('The recorded chains could not be loaded.');
    return response.json();
  }).then(data => {
    if (!Array.isArray(data.chains) || !data.chains.length) throw new Error('No recorded chains are available.');
    return data;
  }).catch(error => { recordings = undefined; throw error; });
  return recordings;
}

const NS = 'http://www.w3.org/2000/svg';
export function sanitizeSVG(source) {
  if (typeof source !== 'string' || source.length > 180000) throw new Error('That drawing could not be read.');
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') throw new Error('That drawing could not be read.');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('viewBox', '0 0 256 256');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'black');
  svg.setAttribute('stroke-width', '3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const child of [...parsed.documentElement.children].slice(0, 100)) {
    if (child.localName !== 'path') continue;
    const d = child.getAttribute('d');
    if (!d || !/^[MmZzLlHhVvCcSsQqTtAaEe\d\s.,+\-]+$/.test(d) || !/[Mm]/.test(d)) continue;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    try { if (path.getTotalLength() > 0 && Number.isFinite(path.getTotalLength())) svg.append(path); } catch { /* Invalid geometry is dropped with its attributes. */ }
  }
  if (!svg.childElementCount) throw new Error('The drawing had no readable ink paths.');
  return svg;
}


let waking = null;
export function wake() {
  waking ??= fetch(`${API}/api/health`, { signal: AbortSignal.timeout(WAKE_LIMIT) }).catch(() => null);
  return waking;
}
async function ready() {
  const slow = setTimeout(() => document.dispatchEvent(new Event('ghosts-waking')), 1200);
  await wake();
  clearTimeout(slow);
}

async function request(path, options = {}) {
  const controller = new AbortController();
  let timeout;
  try {
    // One deadline covers headers and the complete response body.
    return await Promise.race([
      (async () => {
        const response = await fetch(`${API}/api/${path}`, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error('The ghost lost the connection.');
        return response.json();
      })(),
      new Promise((_, reject) => { timeout = setTimeout(() => {
        reject(new Error('The ghost took more than 20 seconds.'));
        controller.abort();
      }, LIVE_TIMEOUT); })
    ]);
  } finally { clearTimeout(timeout); }
}
function post(path, payload) {
  return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
export async function draw(whisper) {
  if (typeof whisper !== 'string' || !whisper.trim()) throw new Error('Give the ghosts a whisper first.');
  await ready();
  const result = await post('draw', { whisper });
  sanitizeSVG(result.svg);
  return { svg: result.svg };
}
export async function whisper(svg) {
  await ready();
  const result = await post('whisper', { svg: sanitizeSVG(svg).outerHTML });
  if (typeof result.text !== 'string' || !result.text.trim() || result.text.length > 500) throw new Error('The ghost returned an unreadable whisper.');
  return { text: result.text };
}

let storageLive = false;
export async function checkStorage() {
  if (new URLSearchParams(location.search).get('storage') !== 'live') return false;
  try { storageLive = (await request('chains/status')).live === true; }
  catch { storageLive = false; }
  return storageLive;
}
export function hasStorage() { return storageLive; }
function validateChain(value) {
  if (!value || value.version !== 2 || !/^[a-f0-9]{12}$/.test(value.id) || typeof value.first !== 'string' || value.first.length > 500 || typeof value.recorded !== 'boolean' || !Array.isArray(value.steps) || value.steps.length !== 6) throw new Error('This chain is incomplete.');
  value.steps.forEach((step, i) => {
    if (!step || typeof step.name !== 'string' || step.name.length > 80) throw new Error('This chain has an unreadable turn.');
    if (step.kind !== (i % 2 === 0 ? 'draw' : 'whisper')) throw new Error('This chain has an unreadable turn.');
    if (step.kind === 'draw') sanitizeSVG(step.svg);
    else if (typeof step.text !== 'string' || !step.text.trim() || step.text.length > 500) throw new Error('This chain has an unreadable whisper.');
  });
  return value;
}
export async function saveChain(chain, publish = false) {
  validateChain(chain);
  try { sessionStorage.setItem(`monster-chain-${chain.id}`, JSON.stringify(chain)); } catch { /* A replay still works until this page closes. */ }
  if (!publish) {
    const replay = new URL(location.href);
    replay.hash = new URLSearchParams({ replay: chain.id });
    return { id: chain.id, replayURL: replay.href };
  }
  if (!storageLive) throw new Error('Link storage is not connected. You can save a PNG strip.');
  const result = await post('chains', chain);
  if (!/^[a-f0-9]{12}$/.test(result.id)) throw new Error('The chain link could not be saved.');
  const url = new URL(location.pathname, location.origin);
  url.hash = new URLSearchParams({ chain: result.id });
  return { id: result.id, url: url.href };
}
export async function loadChain(id, local = false) {
  if (!/^[a-f0-9]{12}$/.test(id || '')) throw new Error('This chain link is unreadable.');
  const value = local ? JSON.parse(sessionStorage.getItem(`monster-chain-${id}`)) : await request(`chains/${id}`);
  const chain = validateChain(value);
  if (chain.id !== id) throw new Error('This chain link is unreadable.');
  return chain;
}
