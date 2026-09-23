// Komachi — visual identity: the fixed pastel palette and name pools (see docs/ART_DIRECTION.md)
import { pick, irand } from './utils.js';

export const PAL = {
  waterfront: {
    paving: ['#b7b7ae', '#c4c3b9', '#aeb0aa'],
    stone: ['#9fa7a8', '#adb3b0', '#8e999c', '#bac0b9', '#a2a9a6'],
    iron: '#4d5558', lamp: '#59636a', light: '#fff3d6',
  },
  richArchitecture: {
    slate: '#424c58', ridge: '#59636d', trim: '#e6dfcf', frame: '#68675f', glass: '#aabbb7',
    timber: '#88745e', stone: '#aaa99c', leaf: '#687f4e', path: '#d7d1c2', door: '#665b4b',
    walls: ['#e4ddca', '#d7cdb8', '#eee6d4', '#b7b5a7', '#c7b294'],
  },
  water:'#b7d8ea', canal:'#a4c9e4', canalBed:'#6c8aa4', foam:'#e2f0f7', skyDay:'#cfe8dd', skyDusk:'#e8c7ad', skyNight:'#3a4b72',
  grass:'#c8d7ad', grass2:'#bccf9f', landSide:'#e8d5b4', sidewalk:'#efe3cc', asphalt:'#9a9ea3', asphalt2:'#8e9296',
  cream:'#f3e6cf', cream2:'#f7efe2', peachWall:'#f1d7c0', greyWall:'#dfe6ea', tealWall:'#b9d1cd', blueWall:'#cfdde6',
  roofRose:'#d98b7a', roofSage:'#7f9b7a', roofBlue:'#8fb0c9', roofPeach:'#e9b08a', roofTeal:'#6f9a96', roofPlum:'#a98ba0',
  wood:'#b98a5b', wood2:'#a3764a', dirt:'#d9c3a1', concrete:'#d9d3c6', concrete2:'#c4bdb1', raw:'#e6d3b1',
  treePeach:'#f0b48b', treeOrange:'#e69a6a', treeSage:'#a9c08a', treeGreen:'#8fae78', bush:'#93b47c', bush2:'#a8c48c', flower:'#f3c6c0',
  lamp:'#c9c3b7', lampGlow:'#ffd08a', window:'#e8dfcf', glow:'#ffb86b',
  pink:'#e9b7b0', mint:'#a9d3c4', lilac:'#c4b7d6', sky2:'#a7c7d9',
  kawara:'#7a828c', kawara2:'#5f6772', indigo:'#5d6b8a',   // grey-blue roof tiles and noren cloth (added with the Japanese identity pass)
};
export const ROOFS = [PAL.roofRose, PAL.roofSage, PAL.roofBlue, PAL.roofPeach, PAL.roofTeal, PAL.roofPlum];
export const WALLS = [PAL.cream, PAL.cream2, PAL.peachWall, PAL.greyWall];
export const SHOP_WALLS = [PAL.cream2, PAL.peachWall, PAL.tealWall, PAL.pink, PAL.mint, PAL.blueWall];
export const WORK_WALLS = [PAL.greyWall, PAL.blueWall, PAL.tealWall, PAL.cream2, PAL.lilac];
export const AWNINGS = [[PAL.roofRose, PAL.cream2], [PAL.roofBlue, PAL.cream2], [PAL.roofTeal, PAL.cream2], [PAL.roofPeach, PAL.cream2]];
export const SKIN = ['#f5d7bd', '#e9c2a0', '#d9a77f', '#b98462', '#8c5e42'];
export const SHIRTS = ['#d98b7a', '#7f9b7a', '#8fb0c9', '#e9b08a', '#6f9a96', '#c4b7d6', '#f3c6c0', '#f3e6cf', '#a98ba0'];
export const HAIR = ['#4a3c36', '#6b4c3a', '#a3764a', '#2f2a2a', '#8a7a6f', '#c58a5a'];
export const CARS = ['#e9b7b0', '#a9d3c4', '#c4b7d6', '#f3e6cf', '#8fb0c9', '#e9b08a', '#dfe6ea'];

export const GIVEN = ['Aoi','Haru','Sora','Yui','Ren','Mei','Kai','Nao','Riku','Hina','Sōta','Rin','Yūto','Saki','Kaito','Mio','Hana','Taiga','Emi','Kenta','Akari','Daiki','Momo','Shun','Nana','Itsuki','Koharu','Ryo','Ayane','Tomo','Yuna','Hikaru','Fumi','Minato','Ichika','Asahi','Sana','Yamato','Kotone','Rei'];
export const FAMILY = ['Sato','Suzuki','Takahashi','Tanaka','Watanabe','Ito','Yamamoto','Nakamura','Kobayashi','Kato','Yoshida','Yamada','Sasaki','Matsumoto','Inoue','Kimura','Hayashi','Shimizu','Mori','Ikeda','Hashimoto','Ishikawa','Ogawa','Fujita','Okada'];
export const SHOP_NAMES = {
  cafe: [['Sora','Café'],['Suzu','Coffee'],['Hana','Tea House'],['Kumo','Kissaten'],['Niji','Café']],
  bakery: [['Momo','Bakery'],['Tsuki','Sweets'],['Ume','Bread'],['Kaede','Bakery']],
  ramen: [['Nami','Ramen'],['Koi','Noodles'],['Yama','Ramen'],['Tora','Ramen']],
  grocery: [['Kiri','Grocer'],['Mori','Greens'],['Oka','Market'],['Yasai','Ya']],
  konbini: [['Nico','Mart'],['Hoshi','Store'],['Yoru','Mart'],['Poko','Mart']],
  florist: [['Kumo','Florist'],['Sumire','Flowers'],['Hana','Hana']],
  books: [['Yuzu','Books'],['Hoshi','Records'],['Ao','Books'],['Fune','Bookshop']],
  restaurant: [['Kaede','Shokudō'],['Umi','Kitchen'],['Tsuki','Teishoku'],['Hinata','Diner'],['Matsu','Izakaya']],
  supermarket: [['Maru','Super'],['Fresh','Oka'],['Nico','Foods'],['Yasai','Land']],
  arcade: [['Hinode','Shotengai'],['Sakura','Arcade'],['Kawa','Dōri'],['Ginza','Shotengai']],
  ryokan: [['Kaze no Yado','Ryokan'],['Hoshizora','Ryokan'],['Yamazato','Inn'],['Tsukikage','Ryokan'],['Matsunami','Inn']],
  teahouse: [['Yamabiko','Tea House'],['Tsukimi','Chaya'],['Matsukaze','Tea House'],['Kumo no Ue','Chaya']],
};
export const WORK_NAMES = {
  office: [['Hikari','Labs'],['Tanaka','Design'],['Sakura','Press'],['Umi','Logistics'],['Aozora','Architects'],['Minato','Software'],['Midori','Clinic'],['Kawa','Accounting'],['Sora','Post Office']],
  workshop: [['Take','Workshop'],['Kaze','Textiles'],['Tetsu','Works'],['Tsubame','Engineering'],['Kiba','Joinery']],
  studio: [['Kumo','Studio'],['Hoshizora','Animation'],['Yume','Games'],['Ao','Pottery'],['Niwa','Studio']],
  factory: [['Tetsu','Precision'],['Komachi','Foods'],['Kaze','Textiles'],['Hikari','Electric'],['Sora','Packaging']],
};
export const CIVIC_NAMES = {
  substation: [['Komachi', 'Substation'], ['Hinode', 'Substation'], ['Kawa', 'Substation']],
  waterworks: [['Komachi', 'Water Works'], ['Kawa', 'Water Works'], ['Izumi', 'Water Works']],
  recycling: [['Komachi', 'Recycling Centre'], ['Midori', 'Recycling'], ['Kaede', 'Recycling Centre']],
  townhall: [['Komachi', 'Town Hall'], ['Komachi', 'Town Office']],
  clinic: [['Midori', 'Clinic'], ['Hinode', 'Clinic'], ['Sakura', 'Family Clinic'], ['Kawa', 'Clinic']],
  firestation: [['Komachi', 'Fire Station'], ['Hoshi', 'Fire Station']],
  community: [['Komachi', 'Community Centre'], ['Kaede', 'Hall'], ['Yanagi', 'Community Centre']],
  square: [['Hinode', 'Square'], ['Komachi', 'Square'], ['Sakura', 'Square'], ['Matsuri', 'Square']],
  bathhouse: [['Yuzu', 'Bath House'], ['Tsuki', 'Bath House'], ['Hoshi', 'Sento'], ['Ume', 'Sento'], ['Matsu', 'Bath House']],
};
export const HOME_SUFFIX = ['Residence','House','Home','Cottage','Villa'];
export const PLACE = ['Sakura','Momiji','Sumire','Tsubaki','Ajisai','Fuji','Kaede','Yanagi','Botan','Kiku','Ume','Matsu','Hinode','Kawa','Oka','Hoshi'];
export const usedNames = new Set();
export function uniqueName(list) {
  for (let k = 0; k < 40; k++) { const [a, b] = pick(list); const n = `${a} ${b}`; if (!usedNames.has(n)) { usedNames.add(n); return n; } }
  const [a, b] = pick(list); return `${a} ${b} ${irand(2, 9)}`;
}
