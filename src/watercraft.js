// One shared Kenney model/atlas load for the offshore and moored fishing boats.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LoadingManager } from 'three';
import boatUrl from '../assets/watercraft/boat-fishing-small.glb?url';
import boatMapUrl from '../assets/watercraft/Textures/colormap.png?url';

export const FISHING_BOAT_SCALE = 0.23;
let fishingBoat;
export async function createFishingBoat() {
  if (!fishingBoat) {
    const manager = new LoadingManager();
    manager.setURLModifier(url => /colormap\.png$/i.test(url) ? boatMapUrl : url);
    fishingBoat = new GLTFLoader(manager).loadAsync(boatUrl).then(({ scene }) => {
      scene.scale.setScalar(FISHING_BOAT_SCALE); // kit bow is +Z; hull base is Y=0
      scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = true;
        for (const material of Array.isArray(o.material) ? o.material : [o.material]) material.roughness = 0.9;
      });
      scene.userData.asset = 'kenney/boat-fishing-small';
      return scene;
    });
  }
  return (await fishingBoat).clone(true); // immutable geometry, material and texture stay shared
}
