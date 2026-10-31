import { sanitizeSVG } from './engine.js';

function wrap(ctx, text, x, y, width, lineHeight) {
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) { ctx.fillText(line, x, y); y += lineHeight; line = word; }
    else line = next;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}
async function drawInk(ctx, source, x, y, size) {
  const svg = sanitizeSVG(source); svg.setAttribute('width', '256'); svg.setAttribute('height', '256');
  const url = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url; await image.decode(); ctx.drawImage(image, x, y, size, size);
  } finally { URL.revokeObjectURL(url); }
}
export async function makeStrip(chain, pair = 1) {
  const selected = Math.max(0, Math.min(2, pair)) * 2;
  const canvas = document.createElement('canvas'); canvas.width = 1500;
  const ctx = canvas.getContext('2d');
  ctx.font = '34px Arial';
  const originalBottom = wrap(ctx, `“${chain.first}”`, -10000, 285, 390, 47);
  const originalDrawingY = Math.max(450, originalBottom + 35);
  ctx.font = '26px Arial';
  const guessBottom = Math.max(
    wrap(ctx, `“${chain.steps[selected + 1].text}”`, -10000, 610, 390, 35),
    wrap(ctx, `“${chain.steps[5].text}”`, -10000, 610, 390, 35)
  );
  canvas.height = Math.max(900, originalDrawingY + 400, guessBottom + 100);
  ctx.fillStyle = '#111f25'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#eff4f1'; ctx.font = '44px Arial'; ctx.fillText('Monster Telephone', 48, 70);
  ctx.font = '18px Arial'; ctx.fillText(chain.recorded ? 'Recorded chain' : 'A monster passed through five AI ghosts', 50, 107);
  const labels = ['Original whisper', selected === 2 ? 'Your rescue and its guess' : 'The drawing and its guess', 'The ending'];
  for (let i = 0; i < 3; i++) {
    const x = 35 + i * 490;
    ctx.fillStyle = '#f1f4f2'; ctx.fillRect(x, 145, 450, canvas.height - 220);

    ctx.fillStyle = '#16272c'; ctx.font = '16px Arial'; ctx.fillText(labels[i], x + 28, 186);
  }
  ctx.fillStyle = '#16272c'; ctx.font = '34px Arial'; wrap(ctx, `“${chain.first}”`, 65, 285, 390, 47);
  await drawInk(ctx, chain.steps[0].svg, 100, originalDrawingY, 310);
  await drawInk(ctx, chain.steps[selected].svg, 580, 215, 340);
  await drawInk(ctx, chain.steps[4].svg, 1070, 215, 340);
  ctx.fillStyle = '#16272c'; ctx.font = '26px Arial';
  wrap(ctx, `“${chain.steps[selected + 1].text}”`, 555, 610, 390, 35);
  ctx.fillStyle = '#16272c'; wrap(ctx, `“${chain.steps[5].text}”`, 1045, 610, 390, 35);
  ctx.fillStyle = '#eff4f1'; ctx.font = '18px Arial'; ctx.fillText('Monster Telephone', 50, canvas.height - 34);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
}
export async function saveStrip(chain, pair) {
  const blob = await makeStrip(chain, pair), url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `monster-telephone-${chain.id}.png`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
