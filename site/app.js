import * as engine from './engine.js';
import * as motion from './motion.js';
import * as sound from './sound.js';
import { ghostArt } from './art.js';
import { saveStrip } from './strip.js';

const $ = id => document.getElementById(id);
const cast = ['pip', 'dot', 'moth', 'hush', 'wisp'];
const turns = [
  { name: 'Pip', ghost: 'pip', kind: 'draw', title: 'A monster<br>takes shape.' },
  { name: 'Dot', ghost: 'dot', kind: 'whisper', title: 'It looks<br>like a…' },
  { name: 'You', ghost: 'pip', kind: 'draw', title: 'Draw it back' },
  { name: 'Moth', ghost: 'moth', kind: 'whisper', title: 'Moth’s guess' },
  { name: 'Hush', ghost: 'hush', kind: 'draw', title: 'One more<br>little creature.' },
  { name: 'Wisp', ghost: 'wisp', kind: 'whisper', title: 'One last guess' }
];
let data, chain, phase = 'idle', stepIndex = 0, pendingResolve, playerResolve;
let strokes = [], currentStroke = null, activePointer = null, rescueTimer;
let flipTimer, flipGeneration = 0, flipPlaying = false, flipIndex = 0;
let runGeneration = 0, suggestion = 0, watchIndex = 0, rescueDrawing;
const smallScreen = matchMedia('(max-width: 700px)');

function placeDrawingControls() {
  if (phase === 'drawing' && smallScreen.matches) $('theatre').after($('drawing-controls'));
  else $('play-aside').before($('drawing-controls'));
}
smallScreen.addEventListener('change', placeDrawingControls);
function announce(message) { $('notice').textContent = message; $('notice').hidden = false; }
function badges() { document.querySelectorAll('[data-recorded]').forEach(el => { el.hidden = !chain?.recorded; }); }
function panel(id) {
  for (const name of ['intro-panel', 'whisper-panel', 'play-panel', 'result-panel']) $(name).hidden = name !== id;
  $('how-to-play').hidden = id !== 'intro-panel';
  $('how-button').hidden = id !== 'intro-panel';
  document.body.classList.toggle('playing', id === 'play-panel' || id === 'result-panel');
}
function showMonster(svg, label = 'A model drawing in ink') {
  const safe = engine.sanitizeSVG(svg);
  $('monster-frame').replaceChildren(safe);
  $('monster-frame').setAttribute('aria-label', label);
  $('monster-frame').hidden = false;
  motion.setInk(safe);
  return safe;
}
function showWords(text) {
  motion.setInk(null);
  const words = document.createElement('p'); words.className = 'flip-whisper'; words.textContent = `“${text}”`;
  $('monster-frame').replaceChildren(words);
  $('monster-frame').setAttribute('aria-label', `Whisper: ${text}`);
}
function paperLabel(kicker, number, footer = '') {
  $('paper-kicker').textContent = kicker; $('paper-number').textContent = '';  $('paper-footer').textContent = footer;
}
function updateTurns(index) {
  $('turn-list').replaceChildren(...turns.map((turn, i) => {
    const item = document.createElement('li'); item.className = i < index ? 'complete' : i === index ? 'active' : '';
    if (i === index) item.setAttribute('aria-current', 'step');
    const number = document.createElement('span'); number.textContent = i < index ? 'Done' : String(i + 1);
    const name = document.createElement('span'); name.textContent = i === 2 && chain.recorded ? 'Recorded rescue' : turn.name;
    const kind = document.createElement('span'); kind.className = 'turn-kind'; kind.textContent = i === 2 && !chain.recorded ? 'draw' : turn.kind === 'draw' ? 'draws' : 'guesses';
    item.append(number, name, kind); return item;
  }));
}
function newChain(first, recorded = false) {
  return { version: 2, id: [...crypto.getRandomValues(new Uint8Array(6))].map(n => n.toString(16).padStart(2, '0')).join(''), first, recorded, steps: [] };
}
function prepareRound() {
  stopFlip(); sound.unlock(); sound.cue('curtain');
  $('notice').hidden = true; $('flipbook-caption').hidden = true; $('failure-controls').hidden = true; $('flipbook-controls').hidden = true;
  $('continue-controls').hidden = true; $('rescue-original').hidden = true; $('next-prompt').hidden = true;
  panel('play-panel'); badges(); phase = 'playing';
  $('turn-title').focus({ preventScroll: true });
}
function prompt(text) {
  $('next-prompt').textContent = `The next drawing starts from “${text}”`;
  $('next-prompt').hidden = false;
}
function setTurn(i) {
  const turn = turns[i]; updateTurns(i);
  $('turn-label').textContent = `Turn ${i + 1} of 6. ${i === 2 && chain.recorded ? 'Recorded rescue' : turn.name}`;
  $('turn-title').innerHTML = i === 2 && chain.recorded ? 'The story<br>drifts again.' : turn.title;
  $('turn-copy').textContent = turn.kind === 'draw' ? 'The whisper is becoming a drawing.' : 'This ghost sees only the drawing.';
  $('rescue-original').hidden = i !== 2 || chain.recorded;
  $('stage-counter').textContent = '';
  paperLabel(turn.kind === 'draw' ? `${i === 2 && chain.recorded ? 'Recorded rescue' : turn.name} draws` : `${turn.name} guesses`, String(i + 1));
  sound.cue(`narrator-${i + 1}`);
}
async function watchRecorded() {
  if (!data) { announce('The recorded chains are still arriving. Try again in a moment.'); return; }
  const record = data.chains[watchIndex++ % data.chains.length];
  chain = newChain(record.start, true); stepIndex = 0;
  const generation = ++runGeneration; prepareRound(); showWords(chain.first);
  performance.clearMarks('recorded-start'); performance.clearMeasures('recorded-playback');
  performance.mark('recorded-start');
  const started = performance.now();
  // Absolute beats keep a slow render from accumulating delay past the trailer.
  const beats = [3400, 6000, 9200, 10000, 13400, 14000];
  const remaining = i => Math.max(0, started + beats[i] - performance.now());
  for (let i = 0; i < 6; i++) {
    if (generation !== runGeneration) return;
    setTurn(i);
    const source = record.steps[i + 1];
    if (source.kind === 'drawing') {
      const text = i === 0 ? chain.first : record.steps[i].text; prompt(text);
      await motion.ghostAction(turns[i].ghost, 'draw', 300);
      await motion.pageTurn(false, 120);
      const drawing = showMonster(source.svg, 'Recorded model drawing');
      chain.steps.push({ kind: 'draw', svg: source.svg, name: i === 2 ? 'Recorded rescue' : turns[i].name });
      await motion.strokeOn(drawing, Math.max(200, remaining(i)));
    } else {
      await motion.ghostAction(turns[i].ghost, 'whisper', 300);
      chain.steps.push({ kind: 'whisper', text: source.text, name: turns[i].name });
      $('turn-copy').textContent = `“${source.text}”`; $('next-prompt').hidden = true;
      await motion.still(remaining(i));
    }
  }
  if (generation === runGeneration) { await finish(); performance.measure('recorded-playback', 'recorded-start'); }
}
async function start(whisper) {
  if (!data || !['idle', 'whisper'].includes(phase)) return;
  if (engine.getMode() === 'recorded') { await watchRecorded(); return; }
  chain = newChain(whisper); stepIndex = 0; rescueDrawing = undefined; ++runGeneration; prepareRound(); showWords(whisper);
  await continueRound();
}
function waitForContinue() {
  phase = 'holding'; $('continue-controls').hidden = false;
  return new Promise(resolve => { pendingResolve = resolve; });
}
async function continueRound() {
  phase = 'playing'; $('failure-controls').hidden = true; $('notice').hidden = true;
  try {
    for (; stepIndex < 6; stepIndex++) {
      const i = stepIndex, turn = turns[i]; setTurn(i);
      const previous = chain.steps.at(-1);
      if (turn.kind === 'draw') {
        const text = i === 0 ? chain.first : i === 2 ? chain.first : previous.text; prompt(text);
        let svg, delegated = false;
        if (i === 2) {
          $('turn-copy').textContent = "They've lost your monster. Draw it back into the story.";
          $('rescue-text').textContent = `“${chain.first}”`;
          $('next-prompt').hidden = true;
          if (rescueDrawing === undefined) rescueDrawing = await playerTurn();
          svg = rescueDrawing; delegated = svg === null;
          // The rescue always starts from the original whisper.
          if (delegated) { $('turn-copy').textContent = 'A ghost is drawing your original whisper.'; prompt(chain.first); }
        }
        if (i !== 2 || delegated) {
          await motion.ghostAction(turn.ghost, 'draw');
          const result = await engine.draw(text); svg = result.svg;
          await motion.pageTurn();
          await motion.strokeOn(showMonster(svg));
        } else showMonster(svg, 'Your rescue drawing');
        chain.steps.push({ kind: 'draw', svg, name: i === 2 ? delegated ? 'Rescue ghost' : 'You' : turn.name, rescue: i === 2, delegated });
        $('turn-copy').textContent = i === 2 ? 'Your rescue is ready for Moth.' : 'The drawing is ready. Take a look before it travels.';
        await waitForContinue();
      } else {
        await motion.ghostAction(turn.ghost, 'whisper');
        const result = await engine.whisper(previous.svg);
        chain.steps.push({ kind: 'whisper', text: result.text, name: turn.name });
        $('turn-copy').textContent = `“${result.text}”`; $('next-prompt').hidden = true;
        // Leave the picture beside its guess and give the rescue reading stillness.
        await motion.still(i === 3 ? 1800 : 1400);
        if (i === 3) {
          await motion.ghostAction('moth', 'whisper');
          $('play-aside').textContent = 'Moth glances back at the paper.';
        }
        if (i < 5) await waitForContinue();
      }
      phase = 'playing';
    }
    await finish();
  } catch (error) {
    phase = 'failed'; $('continue-controls').hidden = true; $('failure-controls').hidden = false;
    $('turn-copy').textContent = error.message;
    announce('The connection stopped. Retry this turn, or watch a separate recorded chain.');
  }
}
function playerTurn() {
  return new Promise(resolve => {
    playerResolve = resolve; phase = 'drawing'; strokes = []; currentStroke = null; activePointer = null;
    $('draw-canvas').replaceChildren(); $('draw-canvas').removeAttribute('hidden'); $('monster-frame').hidden = true;
    $('drawing-controls').hidden = false; $('play-aside').hidden = true; $('theatre').classList.add('drawing-mode');
    $('draw-time').textContent = 'About 30 seconds; take the time you need.';
    clearTimeout(rescueTimer); rescueTimer = setTimeout(() => { $('draw-time').textContent = 'Thirty seconds have passed. Finish when you’re ready.'; }, 30000);
    placeDrawingControls(); $('paper-holder').style.transform = ''; updateTools(); motion.setInk(null);
    paperLabel('Your rescue drawing', '3');
    if (smallScreen.matches) $('rescue-original').scrollIntoView({ behavior: motion.reduced ? 'instant' : 'smooth', block: 'start' });
  });
}
function finishDrawing(delegate = false) {
  if (phase !== 'drawing' || (!delegate && !strokes.length)) return;
  if (activePointer !== null) endStroke({ pointerId: activePointer });
  const svg = delegate ? null : engine.sanitizeSVG($('draw-canvas').outerHTML).outerHTML;
  clearTimeout(rescueTimer); $('draw-canvas').setAttribute('hidden', ''); $('monster-frame').hidden = false;
  $('drawing-controls').hidden = true; $('play-aside').hidden = false; $('theatre').classList.remove('drawing-mode');
  phase = 'playing'; placeDrawingControls(); playerResolve(svg); playerResolve = undefined;
}
function point(event) {
  const matrix = $('draw-canvas').getScreenCTM();
  if (!matrix) return null;
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: Math.max(2, Math.min(254, p.x)), y: Math.max(2, Math.min(254, p.y)) };
}
function beginStroke(event) {
  if (phase !== 'drawing' || activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
  if (strokes.length >= 80) return;
  event.preventDefault();
  activePointer = event.pointerId;
  $('draw-canvas').setPointerCapture(event.pointerId);
  const p = point(event);
  currentStroke = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  currentStroke.setAttribute('d', `M${p.x.toFixed(1)} ${p.y.toFixed(1)}l.1 .1`);
  $('draw-canvas').append(currentStroke); strokes.push(currentStroke);
  sound.cue('pen', .2);
  updateTools();
}
function moveStroke(event) {
  if (phase !== 'drawing' || event.pointerId !== activePointer || !currentStroke) return;
  event.preventDefault();
  const d = currentStroke.getAttribute('d');
  if (d.length > 12000) return;
  const p = point(event);
  currentStroke.setAttribute('d', `${d}L${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
}
function endStroke(event) {
  if (event.pointerId !== activePointer) return;
  if ($('draw-canvas').hasPointerCapture(activePointer)) $('draw-canvas').releasePointerCapture(activePointer);
  activePointer = null; currentStroke = null;
}
function updateTools() { $('done').disabled = $('undo').disabled = !strokes.length; }


async function finish(shared = false) {
  phase = 'result'; panel('result-panel'); badges();
  $('original-text').textContent = `“${chain.first}”`; $('final-text').textContent = `“${chain.steps.at(-1).text}”`;
  $('result-try').hidden = !chain.recorded; $('same').hidden = chain.recorded;
  $('training-note').hidden = !chain.recorded; $('strip-pair').value = '1';
  $('share').hidden = !engine.hasStorage(); $('share-status').textContent = '';
  $('stage-counter').textContent = '';
  await showFlip(6, false); $('flip-play').textContent = '▶ Play flipbook';
  $('result-panel').querySelector('h1').setAttribute('tabindex', '-1'); $('result-panel').querySelector('h1').focus({ preventScroll: true });
  if (!shared) {
    const saved = await engine.saveChain(chain);
    history.replaceState(null, '', saved.replayURL);
  }
  const generation = ++flipGeneration;
  // Both original and ending remain in the comparison while the flipbook plays.
  flipTimer = setTimeout(() => {
    if (generation !== flipGeneration || phase !== 'result') return;
    $('flipbook-controls').hidden = false;
    if (!motion.reduced && !shared) startFlip();
  }, shared ? 0 : 1200);
}
function stopFlip() { clearTimeout(flipTimer); flipGeneration++; flipPlaying = false; $('flip-play').textContent = '▶ Play flipbook'; }
async function showFlip(index, animate = true) {
  $('flipbook-caption').hidden = true;
  flipIndex = index; $('flip-range').value = String(index); $('flip-count').textContent = `${index} / 6`;
  if (index === 0) { paperLabel('The first whisper', '0'); showWords(chain.first); }
  else {
    const entry = chain.steps[index - 1];
    paperLabel(`${entry.name} ${entry.kind === 'draw' ? 'drew' : 'guessed'}`, String(index), chain.recorded ? 'Recorded chain' : entry.rescue ? 'Your rescue drawing' : '');
    if (entry.kind === 'draw') showMonster(entry.svg, `${entry.name}'s drawing`);
    else {
      showMonster(chain.steps[index - 2].svg, `The drawing ${entry.name} read`);
      $('paper-footer').textContent = '';
      $('flipbook-caption').textContent = `“${entry.text}”`; $('flipbook-caption').hidden = false;
    }
  }
  if (animate) await motion.pageTurn();
}
function startFlip(from = 0) {
  stopFlip(); flipPlaying = true; $('flip-play').textContent = 'Ⅱ Pause flipbook'; const generation = flipGeneration;
  async function next(index) {
    if (generation !== flipGeneration || phase !== 'result') return;
    await showFlip(index);
    if (generation !== flipGeneration) return;
    flipTimer = setTimeout(() => { if (index < 6) next(index + 1); else stopFlip(); }, index % 2 === 0 ? 2300 : 1700);
  }
  next(from);
}
function resetGame(whisper = null, clearRoute = true) {
  ++runGeneration; stopFlip(); sound.stopAll(); clearTimeout(rescueTimer); phase = whisper ? 'whisper' : 'idle'; chain = null;
  $('notice').hidden = true; $('flipbook-caption').hidden = true; $('flipbook-controls').hidden = true; $('drawing-controls').hidden = true;
  $('draw-canvas').setAttribute('hidden', ''); $('theatre').classList.remove('drawing-mode'); placeDrawingControls();
  $('paper-holder').style.transform = ''; $('play-aside').hidden = false;
  $('play-aside').textContent = 'Ghosts only see the drawing. They can get it wrong.';
  panel(whisper ? 'whisper-panel' : 'intro-panel'); badges();
  if (whisper) $('first-whisper').value = whisper;
  if (data) showMonster(data.chains[0].steps[1].svg, 'Recorded model drawing: a bat with too many teeth');
  paperLabel('Recorded model drawing', '1', data?.chains[0].start || '');
  $('stage-counter').textContent = '';
  if (clearRoute) history.replaceState(null, '', location.pathname + location.search);
}
async function shareChain() {
  $('share').disabled = true;
  try {
    const result = await engine.saveChain(chain, true);
    try { await navigator.clipboard.writeText(result.url); $('share-status').textContent = 'Chain link copied.'; }
    catch { const link = document.createElement('a'); link.href = result.url; link.textContent = result.url; $('share-status').replaceChildren(link); }
  } catch (error) { $('share-status').textContent = error.message; }
  finally { $('share').disabled = false; }
}
for (const name of cast) $(`ghost-${name}`).innerHTML = ghostArt(name);
motion.initMotion();
$('watch').addEventListener('click', watchRecorded);
$('try').addEventListener('click', () => resetGame($('first-whisper').value));
$('result-try').addEventListener('click', () => resetGame(chain.first));
$('same').addEventListener('click', () => { const first = chain.first; resetGame(first); start(first); });
$('again').addEventListener('click', () => resetGame(data.chains[(++suggestion) % data.chains.length].start));
$('start-form').addEventListener('submit', event => { event.preventDefault(); const text = $('first-whisper').value.trim(); if (text) start(text); });
$('shuffle').addEventListener('click', () => { if (data) $('first-whisper').value = data.chains[++suggestion % data.chains.length].start; });
$('how-button').addEventListener('click', () => $('how-to-play').scrollIntoView({ behavior: motion.reduced ? 'instant' : 'smooth', block: 'center' }));
$('sound-toggle').addEventListener('click', () => {
  const muted = sound.toggleMute(); $('sound-toggle').setAttribute('aria-pressed', String(!muted));
  $('sound-toggle').setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute sound');
  $('sound-toggle').querySelector('span').textContent = muted ? 'Sound off' : 'Sound on';
  $('sound-toggle').querySelector('path').setAttribute('d', muted ? 'M11 5 6 9H3v6h3l5 4zM16 9l5 6m0-6-5 6' : 'M11 5 6 9H3v6h3l5 4zM16 8q4 4 0 8m3-11q7 7 0 14');
});
$('draw-canvas').addEventListener('pointerdown', beginStroke);
$('draw-canvas').addEventListener('pointermove', moveStroke);
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) $('draw-canvas').addEventListener(name, endStroke);
$('undo').addEventListener('click', () => { strokes.pop()?.remove(); updateTools(); });
$('done').addEventListener('click', () => finishDrawing()); $('pass').addEventListener('click', () => finishDrawing(true));
$('paper-holder').addEventListener('click', () => motion.finishStroke());
$('continue').addEventListener('click', () => { $('continue-controls').hidden = true; const resolve = pendingResolve; pendingResolve = undefined; resolve?.(); });
$('retry').addEventListener('click', () => { if (phase === 'failed') continueRound(); });
$('failure-watch').addEventListener('click', watchRecorded);
$('save-strip').addEventListener('click', async () => {
  $('save-strip').disabled = true; $('share-status').textContent = '';
  try { await saveStrip(chain, Number($('strip-pair').value)); $('share-status').textContent = 'PNG strip saved.'; }
  catch { $('share-status').textContent = 'The PNG could not be saved. Try again.'; }
  finally { $('save-strip').disabled = false; }
});
$('share').addEventListener('click', shareChain);
$('flip-play').addEventListener('click', () => { if (flipPlaying) stopFlip(); else startFlip(flipIndex >= 6 ? 0 : flipIndex); });
$('flip-range').addEventListener('input', event => { stopFlip(); showFlip(Number(event.target.value), false); });
document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'result') stopFlip(); });
async function openSaved() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has('chain') && !params.has('replay')) return;
  if (!['idle', 'whisper', 'result'].includes(phase)) return;
  try { chain = await engine.loadChain(params.get('chain') || params.get('replay'), params.has('replay')); await finish(true); }
  catch (error) { resetGame(); announce(error.message); }
}
window.addEventListener('hashchange', openSaved);
// A missing storage service is ordinary for the static build; it exposes no link UI.
if (engine.getMode() === 'live') engine.wake();
document.addEventListener('ghosts-waking', () => { $('turn-copy').textContent = 'The ghosts are waking up. The first turn can take a minute.'; });
engine.checkStorage().then(live => { if (phase === 'result') $('share').hidden = !live; });
try { data = await engine.loadRecordings(); resetGame(null, false); await openSaved(); }
catch (error) { announce(`${error.message} Reload to try again.`); }
