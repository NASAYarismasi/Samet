import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as THREE from 'three';
import {createOvaWorld} from '../src/colony/ihan/crater-ecosystem.mjs';
import {createOvaNavigation} from '../src/colony/ihan/navigation.mjs';
import {calculateEclss} from '../src/colony/ihan/eclss.mjs';
import {prepareOvaRover} from '../src/colony/ihan/assets.mjs';

const context = () => ({
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
  getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
  createRadialGradient:()=>({addColorStop(){}}),putImageData(){},fillRect(){},fillText(){},
  beginPath(){},arc(){},ellipse(){},fill(){},stroke(){},moveTo(){},lineTo(){},
});
let scene,world;
beforeEach(()=>{
  vi.stubGlobal('document',{createElement:()=>({getContext:context}),createElementNS:()=>({addEventListener(){},removeEventListener(){},style:{}})});
  scene=new THREE.Scene(); world=createOvaWorld(scene); scene.updateMatrixWorld(true);
});
afterEach(()=>{
  world.dispose(); const resources=new Set();
  scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of [o.material].flat())if(m){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});
  resources.forEach(r=>r.dispose()); vi.unstubAllGlobals();
});
describe('İhan Düz Ova world (real source a7d5ce6)',()=>{
  it('keeps the three connected dome floors and source camera positions',()=>{
    for(const x of [-9,0,9,-4.5,4.5]) expect(world.isInsideFloor(x,0)).toBe(true);
    expect(world.isInsideFloor(0,5)).toBe(false);
    expect(world.blocksFootprint(0,7,5,5)).toBe(true);
    expect(world.blocksFootprint(0,20,2,2)).toBe(false);
    expect(world.views.panorama.position[2]).toBe(28);
    expect(world.views.base.position).toEqual([24,16,30]);
    expect(world.views.solar.target[0]).toBe(-57);
    const domes=world.habitat.children.filter(o=>o.isGroup && o.name!=="SanitaryRoom" && o.position.y===world.floorY);
    expect(domes).toHaveLength(3);
  });
  it('keeps 42 solar tables in five instanced batches, rocks instanced, and adds no shadow light',()=>{
    const farm=scene.getObjectByName('MarsSolarFarm');
    const panelBatches=farm.children.filter(o=>o.isInstancedMesh&&o.name!=="SolarCleaningBrushes");
    expect(panelBatches.map(o=>o.count).sort((a,b)=>a-b)).toEqual([42,42,168,168]);
    const draws=[];farm.traverse(o=>{if(o.isMesh&&o.material?.visible!==false)draws.push(o)});expect(draws.length).toBeLessThanOrEqual(28);
    expect(typeof world.solar.updateBatteryDisplay).toBe('function');
    const lights=[];scene.traverse(o=>{if(o.isLight)lights.push(o);});
    expect(lights).toHaveLength(4); expect(lights.every(o=>!o.castShadow)).toBe(true);
    const rocks=scene.children.filter(o=>o.isInstancedMesh);
    expect(rocks).toHaveLength(5);expect(rocks.reduce((sum,o)=>sum+o.count,0)).toBe(7140);
    expect(scene.getObjectByName('Mars_environment')).toBeUndefined();
  });
  it('matches rendered ground triangles at the lander, pad, and solar field',()=>{
    const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
    for(const [x,z]of [[0,0],[-18,22],[30,30],[-57,46],[149,-133]]){
      ray.set(new THREE.Vector3(x,100,z),down);
      // İhan's analytic height vs the rendered triangle: within 1 cm (walker feet never float/sink visibly).
      expect(Math.abs(world.ground.userData.heightAt(x,z)-ray.intersectObject(world.ground)[0].point.y)).toBeLessThan(.01);
    }
  });
  it('removes scene-refraction passes from shared rover lenses without changing the hierarchy',()=>{
    const rover=new THREE.Group(), lens=new THREE.MeshPhysicalMaterial({transmission:1});
    const metal=new THREE.MeshStandardMaterial({metalness:.8});
    rover.add(new THREE.Mesh(new THREE.BoxGeometry(),lens),new THREE.Mesh(new THREE.BoxGeometry(),lens),new THREE.Mesh(new THREE.BoxGeometry(),metal));
    const children=[...rover.children];prepareOvaRover(rover);
    expect(rover.children).toEqual(children);expect(lens.transmission).toBe(0);
    expect(lens.transparent).toBe(true);expect(lens.depthWrite).toBe(false);expect(metal.metalness).toBe(.8);
    rover.traverse(o=>o.geometry?.dispose());lens.dispose();metal.dispose();
  });
  it('starts the laboratory only near the instrument and completes its scan',()=>{
    const camera=new THREE.PerspectiveCamera();camera.position.set(-9,world.floorY+1.65,-.5);camera.lookAt(-9,world.floorY+1.4,-2);
    expect(world.startLab(0,0,camera)).toBe(false);expect(world.startLab(-9,-.5,camera)).toBe(true);
    world.updateLab(3);expect(world.soilAnalysis.phase).toBe('scanning');world.updateLab(3);expect(world.soilAnalysis.result.illustrative).toBe(true);
    camera.lookAt(-9,world.floorY+1.4,3);expect(world.startLab(-9,-.5,camera)).toBe(false);
  });
  it('gates entry/exit by proximity, contains the player, and allows both tunnels',()=>{
    expect(world.locks).toHaveLength(1);
    const nav=createOvaNavigation(world);
    expect(nav.interact(0,14)).toBeNull(); expect(nav.inside).toBe(false);
    expect(nav.collides(0,0)).toBe(true); expect(nav.collides(-57,42)).toBe(true);
    const entry=nav.interact(0,7.5); expect(nav.inside).toBe(true);
    expect(entry).toMatchObject({x:0,z:4.01,y:world.floorY,yaw:0});
    expect(nav.collides(0,4)).toBe(false);expect(nav.collides(0,2)).toBe(true);
    expect(nav.update(10)).toBeNull();expect(nav.prompt(0,4)).toContain('ikinci');
    expect(world.locks[0].inner.position.x).toBe(0);expect(world.locks[0].outer.position.x).toBe(0);
    nav.interact(0,4);const arrived=nav.update(1.4);expect(arrived.z).toBe(2.35);
    for(const x of [-9,-4.5,0,4.5,9])expect(nav.collides(x,0)).toBe(false);expect(nav.collides(9,-4.2)).toBe(false);expect(nav.collides(9.65,-5.9)).toBe(true);
    expect(nav.collides(0,5)).toBe(true);expect(nav.interact(9,0)).toBeNull();
    const outward=new THREE.PerspectiveCamera();outward.position.set(0,world.floorY+1.65,2.45);outward.quaternion.setFromEuler(new THREE.Euler(0,Math.PI,0,'YXZ'));expect(nav.interact(0,2.45,outward).yaw).toBe(Math.PI);nav.update(5);
    expect(world.locks[0].outer.position.x).toBe(0);nav.interact(0,4,outward);
    const exit=nav.update(1.4);expect(exit.z).toBeCloseTo(7.35,9);expect(exit.yaw).toBe(Math.PI);
    expect(nav.inside).toBe(false);nav.interact(0,6);nav.reset();expect(nav.inside).toBe(false);

  });
});
describe('İhan ECLSS reference calculator',()=>{
  it('preserves the original three-person rates and electrolysis stoichiometry',()=>{
    const stored=calculateEclss(10,0,false);
    expect(stored.water).toBeCloseTo(105.6);expect(stored.oxygen).toBeCloseTo(25.2);expect(stored.foodKcal).toBe(91050);
    const recycled=calculateEclss(10,90,true);
    expect(recycled.savedWater).toBeCloseTo(95.04);expect(recycled.water).toBeCloseTo(10.56+25.2*9/8);expect(recycled.oxygen).toBe(0);
  });
});

