// Stateless choices: adding a detail never advances the town's random stream.
export function architecturalChoice(seed, channel) {
  let h = (Math.floor(seed * 4294967296) ^ Math.imul(channel, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

// A bounded grammar for one-cell homes. Openings, paths and roofs all use this
// layout; upgrades keep the same footprint and material choices.
export function housePlan(seed, level, variant) {
  const choice = channel => architecturalChoice(seed, channel);
  const w = 0.66 + Math.floor(choice(1) * 3) * 0.04;
  const d = 0.57 + Math.floor(choice(2) * 3) * 0.025;
  const floors = variant === 'villa' ? 1 : Math.min(2, Math.max(1, level));
  const step = 0.37, bay = w * 0.255;
  return {
    w, d, floors, step, height: floors * step, bay,
    doorX: -bay, windowWidth: w * 0.22,
    wallIndex: Math.floor(choice(3) * 5), timber: choice(4) > 0.4,
    roofRise: 0.19 + choice(5) * 0.055,
    ridgeRatio: 0.38 + choice(6) * 0.2,
    dormer: choice(7) > 0.45, mailbox: choice(8) > 0.5,
  };
}
