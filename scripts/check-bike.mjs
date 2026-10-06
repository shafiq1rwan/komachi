import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
const executablePath = [process.env.BROWSER_PATH, `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
const server = await createServer({ server: { open: false, port: 4190, strictPort: true } }); await server.listen(); let browser;
try {
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4190/?seed=7', { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.waitForFunction(() => window.MT?.characterAvailable() && MT.serviceReady(), { timeout: 120000 });
  const result = await page.evaluate(async () => {
    MT.demoTown();
    MT.setSpeed(0); MT.setHour(8);
    let rider, parked;
    for (let i = 0; i < 500; i++) {
      MT.fastForward(.03);
      rider = MT.residents.find(r=>r.bikeKind !== 'scooter' && r.trip?.ride && r.mesh.userData.char);
      parked = MT.residents.find(r=>r.bikeKind !== 'scooter' && r.bike?.visible && r.bike.userData.parked);
      if(rider && parked) break;
    }
    if(!rider || !parked) throw new Error('No riding and parked bicycle found');
    const bike=rider.bike, still=parked.bike, wheel=bike.getObjectByName('Wheel_Front'), before=wheel.quaternion.clone(), parkedPhase=still.userData.wheels.map(w=>w.rotation.x);
    for (const r of MT.residents.filter(r=>r.bike && r.bikeKind !== 'scooter')) {
      if (!r.bike.userData.residentTricycle || r.bike.userData.wheels.length !== 3) throw Error('Resident still has a bicycle');
      if (!r.bike.getObjectByName('Front_Cargo_Box') || !r.bike.getObjectByName('Rear_Cargo_Box')) throw Error('Missing cargo boxes');
      if (r.bike.getObjectByName('Police_Star') || r.bike.getObjectByName('Toy_Blue_Beacon')) throw Error('Police details on resident tricycle');
    }
    const stopped=still.position.clone();
    MT.fastForward(.002);
    if (wheel.quaternion.angleTo(before)<.001) throw new Error('Riding wheels did not turn');
    if (still.userData.parked && still.userData.wheels.some((w,i)=>w.rotation.x!==parkedPhase[i])) throw new Error('Parked wheels turned');
    if (rider.trip?.ride && Math.abs(rider.mesh.position.y-bike.position.y-(bike.userData.seat.y-.09*.85))>.001) throw new Error('Incorrect saddle height');
    MT.save();
    return { name:bike.name, parked:still.userData.parked, parkedMoved:still.position.distanceTo(stopped), wheelTurn:wheel.quaternion.angleTo(before), cargoBoxes:2, residentTricycles:MT.residents.filter(r=>r.bike?.userData.residentTricycle).length };
  });
  await page.reload({waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.MT?.characterAvailable() && MT.serviceReady(),{timeout:120000});
  const restored = await page.evaluate(()=>{
    const owners=MT.residents.filter(r=>r.home && r.hasBike && r.bikeKind !== 'scooter');
    if (!owners.length || owners.some(r=>!r.bike?.userData.residentTricycle || !r.bike.getObjectByName('Rear_Cargo_Box'))) throw Error('Saved bicycle owners did not restore with cargo tricycles: '+JSON.stringify(owners.map(r=>({name:r.name,bike:!!r.bike,cargo:r.bike?.userData.residentTricycle}))));
    return owners.length;
  });
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Resident cycling, parking and save restoration passed:', { ...result, restored });
} finally { await browser?.close(); await server.close(); }
