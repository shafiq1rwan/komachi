// electron-builder afterPack hook: gives the macOS app an ad-hoc signature when no certificate is configured. Apple Silicon
// refuses to launch a binary with no signature at all ("Komachi is damaged and can't be opened"); an ad-hoc signature
// (codesign --sign -) needs no Apple account and lets the app open after the usual right-click → Open. A real Developer ID
// (CSC_LINK / CSC_KEY_PASSWORD secrets) makes electron-builder sign properly and this hook does nothing.
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;   // a real certificate is in play: leave it to the builder
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', app], { stdio: 'inherit' });
    execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
    console.log(`  • ad-hoc signed ${app}`);
  } catch (err) {
    console.warn(`  • ad-hoc signing failed (${err.message}); the app may not open on Apple Silicon`);
  }
};
