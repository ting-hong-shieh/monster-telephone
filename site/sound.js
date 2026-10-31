// No generated audio and no network requests for absent optional files.
const files = new Map();
const active = new Set();
let unlocked = false;
let muted = true;

fetch(new URL('data/audio/manifest.json', import.meta.url)).then(r => r.ok ? r.json() : {}).then(manifest => {
  for (const [cue, name] of Object.entries(manifest)) {
    if (typeof name === 'string' && /^[a-z\d_-]+\.(mp3|wav|ogg|m4a)$/i.test(name)) files.set(cue, name);
  }
}).catch(() => {});

export function unlock() { unlocked = true; }
export function isMuted() { return muted; }
export function toggleMute() {
  unlocked = true;
  muted = !muted;
  if (muted) stopAll();
  return muted;
}
export function cue(name, volume = .5) {
  if (!unlocked || muted || !files.has(name)) return;
  const audio = new Audio(new URL(`data/audio/${files.get(name)}`, import.meta.url));
  audio.volume = Math.max(0, Math.min(volume, 1));
  active.add(audio);
  const cleanup = () => active.delete(audio);
  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('error', cleanup, { once: true });
  audio.play().catch(cleanup);
}
export function stopAll() { for (const audio of active) audio.pause(); active.clear(); }
