// Original stage characters. Separate edge and eye groups let poses overlap.
const bodies = {
  pip: 'M26 91Q11 65 27 40Q33 28 37 21L42 34Q61 19 74 39Q85 54 81 80L93 95Q79 101 67 88L57 100 47 88 35 101Z',
  dot: 'M23 92V57Q19 28 52 28Q84 28 83 57L88 94 73 89 66 100 53 91 42 99 35 88Z',
  moth: 'M17 89Q26 80 28 64Q29 32 49 29Q71 26 77 48Q87 54 91 72L101 80Q94 91 79 89L73 99 61 90 49 100 38 91Q26 99 17 89Z',
  hush: 'M30 97Q21 86 25 68Q25 18 50 14Q77 13 78 65L85 99 72 92 61 101 52 91 40 102Z',
  wisp: 'M11 93Q22 80 26 59Q22 36 42 29Q48 26 50 17Q64 23 63 32Q82 36 80 59Q81 83 99 93L84 99 73 90 62 101 49 90 38 100 28 91Z'
};
const details = {
  pip: '<path class="ink" d="M28 46 16 41m62-5 9-10M44 72q9 12 18-1M48 76v5m9-5v5"/><path class="eye" d="M39 53a3 4 0 1 0 6 0 3 4 0 1 0-6 0m22-2a3 4 0 1 0 6 0 3 4 0 1 0-6 0"/>',
  dot: '<path class="ink" d="M27 51q12-12 22 1m10-1q12-11 23 1M49 54h10M44 76q10-5 20 0M30 36l-5-6m9 3-1-7"/><g class="eyes"><circle class="ink" cx="40" cy="56" r="11"/><circle class="ink" cx="69" cy="56" r="11"/><path class="eye" d="M39 52v6h3v-6zm28 0v6h3v-6z"/></g>',
  moth: '<path class="ink" d="M34 53q5-5 10 0m12-3q5-5 10 0M46 68q5 6 10 0M64 27q9-11 18-6-9 3-13 11M73 19l4-6"/><path class="ink" d="m32 76-11-5m3 0-3-5M81 63l10-7"/><path class="eye" d="M38 53v3h2v-3m20-3v3h2v-3"/>',
  hush: '<path class="ink" d="m33 43 8-4m19 0 8 4M45 72q6-7 13 0M34 79q6-11 12-5m10 0q6-5 12 5"/><g class="eyes"><path class="eye" d="M36 51a3 5 0 1 0 6 0 3 5 0 1 0-6 0m25 0a3 5 0 1 0 6 0 3 5 0 1 0-6 0"/></g>',
  wisp: '<path class="ink" d="m29 48 12-5m19 1 13 7M45 70q7 9 14 0M31 75l-15-8m58 8 16-13M39 88l12-8 12 8-12 4Z"/><g class="eyes"><path class="eye" d="M35 53a3 4 0 1 0 6 0 3 4 0 1 0-6 0m25 0a3 4 0 1 0 6 0 3 4 0 1 0-6 0"/></g>'
};
export function ghostArt(name) {
  const edge = name === 'pip' ? 'M27 87 35 101 47 88 57 100 67 88 80 97 89 95' : name === 'hush' ? 'M30 94 40 102 52 91 61 101 72 92 83 98' : name === 'dot' ? 'M24 92 35 88 42 99 53 91 66 100 73 89 86 94' : name === 'wisp' ? 'M15 94 28 91 38 100 49 90 62 101 73 90 84 99 95 94' : 'M20 90 38 91 49 100 61 90 73 99 79 89 92 87';
  return `<svg viewBox="0 0 110 112" aria-hidden="true"><g class="ghost-body"><path d="${bodies[name]}"/><g class="ghost-face">${details[name]}</g><g class="sheet-edge"><path d="${edge}"/><path d="M30 81q4 4 2 8m41-10q-4 4 0 9"/></g></g></svg>`;
}
