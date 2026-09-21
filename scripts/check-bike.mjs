import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
const executablePath = [process.env.BROWSER_PATH, `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
const server = await createServer({ server: { open: false, port: 4190, strictPort: true } }); await server.listen(); let browser;
try {
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4190/?demo&seed=7', { waitUntil: 'networkidle0' }); await page.waitForFunction(() => window.MT?.characterAvailable());
  const result = await page.evaluate(async () => {
    const { BIKE_SEAT } = await import('/src/bikes.js');
    MT.setSpeed(0); MT.setHour(8);
    let rider, parked;
    for (let i = 0; i < 500; i++) {
      MT.fastForward(.03);
      rider = MT.residents.find(r=>r.trip?.ride && r.mesh.userData.char);
      parked = MT.residents.find(r=>r.bike?.visible && r.bike.userData.parked);
      if(rider && parked) break;
    }
    if(!rider || !parked) throw new Error('No riding and parked bicycle found');
    const bike=rider.bike, still=parked.bike, wheel=bike.getObjectByName('Front_Wheel'), before=wheel.quaternion.clone(), parkedPhase=still.bikeParts.phase;
    const stopped=still.position.clone();
    MT.fastForward(.002);
    if (wheel.quaternion.angleTo(before)<.001) throw new Error('Riding wheels did not turn');
    if (still.userData.parked && still.bikeParts.phase!==parkedPhase) throw new Error('Parked wheels turned');
    if (rider.trip?.ride && Math.abs(rider.mesh.position.y-bike.position.y-(BIKE_SEAT.y-.09))>.001) throw new Error('Incorrect saddle height');
    return { name:bike.name, parked:still.userData.parked, parkedMoved:still.position.distanceTo(stopped), wheelTurn:wheel.quaternion.angleTo(before), riderPose:!!rider.mesh.userData.char.sitting, triangles:bike.children.filter(x=>x.isMesh).reduce((n,m)=>n+m.geometry.attributes.position.count/3,0) };
  });
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Resident cycling and parking passed:', result);
} finally { await browser?.close(); await server.close(); }
