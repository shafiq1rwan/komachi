// Komachi — island themes. A biome is data only: colours, vegetation mix, shoreline character.
// Select with ?biome=<id>. Everything else in the game reads from `biome` rather than hard-coding.
import { S } from './state.js';

export const BIOMES = {
  suburban: {
    id: 'suburban', name: 'Suburban island',
    grass: '#c8d7ad', sand: '#eadfc0', rock: ['#b7b0a3', '#a49c90'],
    treeColors: ['#f0b48b', '#e69a6a', '#a9c08a', '#8fae78'],   // peach, orange, sage, green
    pineRatio: 0.15, blossom: false, treeDensity: 1.0,
    shoreBias: 0,           // >0 more beach, <0 more rock
  },
  sakura: {
    id: 'sakura', name: 'Cherry blossom town',
    grass: '#cddbb3', sand: '#eadfc0', rock: ['#b7b0a3', '#a49c90'],
    treeColors: ['#f4c4cf', '#f8d7de', '#eeb3c2', '#a9c08a'],
    pineRatio: 0.05, blossom: true, treeDensity: 1.15,
    shoreBias: 0.2,
  },
  coastal: {
    id: 'coastal', name: 'Coastal fishing town',
    grass: '#c2d4a9', sand: '#e6dcbd', rock: ['#a9a49a', '#8f8a80'],
    treeColors: ['#a9c08a', '#8fae78', '#7f9b7a', '#e69a6a'],
    pineRatio: 0.45, blossom: false, treeDensity: 0.8,
    shoreBias: -0.25,
  },
};
export const biome = BIOMES[S.biome] || BIOMES.suburban;
