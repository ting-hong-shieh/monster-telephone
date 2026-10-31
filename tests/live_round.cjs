const {createRequire}=require('node:module');
const {chromium}=createRequire('/home/elias-shieh/projects/personal/prepare-4-quant/')('playwright');
const fs=require('node:fs');
const BASE=process.argv[2], OUT=__dirname+'/live', WIDTH=+(process.argv[3]||1440);
fs.mkdirSync(OUT,{recursive:true});
const crab=JSON.parse(fs.readFileSync(__dirname+'/answers/drawings/crab.json'));
const svg=(crab.data||crab).svg;
const strokes=[...svg.matchAll(/d="([^"]+)"/g)].map(m=>[...m[1].matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(p=>[+p[1],+p[2]]));
(async()=>{
 const browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:WIDTH,height:WIDTH<500?844:900}});
 const log=[];const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('response',async r=>{if(/\/api\/(draw|whisper)/.test(r.url())){let b='';try{const j=await r.json();b=j.text||'[drawing]'}catch{};log.push([r.url().split('/').pop(),r.status(),b]);console.log(r.url().split('/').pop(),r.status(),b)}});
 const shot=n=>page.screenshot({path:`${OUT}/${WIDTH}-${n}.png`});
 const advance=async()=>{await page.locator('#continue').waitFor({state:'visible',timeout:45000});await page.locator('#continue').click()};
 await page.goto(BASE);await page.locator('#monster-frame svg').waitFor();await page.waitForTimeout(1500);await shot('home');
 await page.locator('#try').click();await page.locator('#first-whisper').fill('a crab with enormous claws');await page.locator('#start-form button[type=submit]').click();
 await advance();
 await page.locator('#drawing-controls').waitFor({state:'visible',timeout:45000});await page.waitForTimeout(800);await shot('rescue-empty');
 const box=await page.locator('#draw-canvas').boundingBox();
 const at=([x,y])=>[box.x+box.width*x/256,box.y+box.height*y/256];
 for(const s of strokes){const pts=s.filter((_,i)=>i%2===0);await page.mouse.move(...at(pts[0]));await page.mouse.down();for(const p of pts.slice(1))await page.mouse.move(...at(p));await page.mouse.up()}
 await shot('rescue-drawn');await page.locator('#done').click();
 await page.locator('#result-panel').waitFor({state:'visible',timeout:90000});await page.waitForTimeout(2500);await shot('reveal');
 console.log(JSON.stringify({errors,calls:log.length,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
 await browser.close();
})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
