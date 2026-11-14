import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { createTerminalTexture } from './terminal-texture.js';

// Z-up, T-pose STL has no bones. Retain its actual positive-X arm triangles.
export function extractArm(source) {
  const data=source.attributes.position,positions=[],scale=1.8/74.2626838684082;
  for(let i=0;i<data.count;i+=3)if([0,1,2].every(j=>data.getX(i+j)>16.5 && (data.getZ(i+j)+37.13139343261719)*scale>1.19 && (data.getZ(i+j)+37.13139343261719)*scale<1.47)){
    for(let j=0;j<3;j++)positions.push(data.getX(i+j)*scale-.40,(data.getZ(i+j)+37.13139343261719)*scale-1.32,-data.getY(i+j)*scale-.09);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}

export function createWristScene(host,getData){
  const renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x28323a);host.append(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x9b7052,6,40);
  const camera=new THREE.PerspectiveCamera(62,1,.02,90);camera.position.y=1.65;scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xe6efff,0x73503b,3));
  const sun=new THREE.DirectionalLight(0xffdfb1,3);sun.position.set(-4,7,3);scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x966448,roughness:1}));ground.rotation.x=-Math.PI/2;scene.add(ground);
  for(let i=0;i<45;i++){
    const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.1+(i%5)*.04,0),new THREE.MeshStandardMaterial({color:i%2?0x694f41:0x82604a,roughness:1}));
    rock.position.set(Math.sin(i*17)*12,.08,-2-i*.6);rock.scale.y=.6;scene.add(rock);
  }
  const rig=new THREE.Group();camera.add(rig);
  const hidden=new THREE.Vector3(-.32,-.85,-.66),shown=new THREE.Vector3(-.30,-.21,-.68);rig.position.copy(hidden);
  const hiddenRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,-.2,-.5));
  const shownRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(1.35,0,.30));
  const surface=document.createElement('canvas');surface.width=1152;surface.height=710;const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;
  const terminal=new THREE.Group();terminal.position.set(.17,.080,.015);terminal.rotation.x=-Math.PI/2;rig.add(terminal);
  // 14 x 9 cm: case follows the forearm axis and stays within its width.
  terminal.add(new THREE.Mesh(new THREE.BoxGeometry(.14,.09,.014),new THREE.MeshStandardMaterial({color:0x20242e,metalness:.35,roughness:.65})));
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(.130,.082),new THREE.MeshBasicMaterial({map:texture}));screen.position.z=.0072;terminal.add(screen);
  const strap=new THREE.Group();
  for(const x of [.125,.215]){
    const band=new THREE.Mesh(new THREE.TorusGeometry(.060,.004,8,36),new THREE.MeshStandardMaterial({color:0x262b32,roughness:.9}));
    band.rotation.y=Math.PI/2;band.scale.y=.90;band.position.set(x,0,.015);strap.add(band);
  }
  rig.add(strap);
  const display=createTerminalTexture(canvas=>{surface.getContext("2d").drawImage(canvas,0,0,1152,710);texture.needsUpdate=true;});
  let target=0,amount=0,running=false,disposed=false,arm,loading=false,last=0;
  const status=document.querySelector('#model-status'),retry=document.querySelector('#model-retry');terminal.visible=false;strap.visible=false;
  async function load(){
    if(loading||arm||disposed)return;loading=true;status.hidden=false;status.textContent='Astronot modeli yükleniyor…';retry.hidden=true;
    try{
      const geometry=await new STLLoader().loadAsync(new URL('./models/astronaut.stl',document.baseURI).href);
      if(disposed){geometry.dispose();return;}
      const extracted=extractArm(geometry);geometry.dispose();
      arm=new THREE.Mesh(extracted,new THREE.MeshStandardMaterial({color:0xd8d6c6,roughness:.85,side:THREE.DoubleSide}));rig.add(arm);
      // Continue the cropped STL sleeve beyond the left edge of the view.
      // The forearm and terminal keep their measured size and attachment.
      const sleeve=new THREE.Mesh(
        new THREE.CylinderGeometry(.067,.092,1.05,16,8,true),
        arm.material
      );
      sleeve.rotation.z=-Math.PI/2;
      sleeve.position.set(-.49,0,.012);
      arm.add(sleeve);
      terminal.visible=true;strap.visible=true;status.hidden=true;
    }catch(error){status.textContent='Astronot modeli yüklenemedi. Bağlantını kontrol edip yeniden dene.';retry.hidden=false;console.error(error);}finally{loading=false;}
  }
  retry.onclick=load;
  function update(){
    const data=getData();renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label',`Bilek terminali. Batarya ${data.resources.energy}, su ${data.resources.water}, oksijen ${data.resources.oxygen}, yiyecek ${data.resources.food}. Gorev: ${data.mission}`);display.update(data);
  }
  const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);
  function frame(time){if(!running)return;const dt=Math.min((time-last)/1000,.05);last=time;const speed=window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:1-Math.exp(-dt*11);amount+=(target-amount)*speed;rig.position.lerpVectors(hidden,shown,amount);rig.quaternion.slerpQuaternions(hiddenRotation,shownRotation,amount);rig.visible=amount>.005;renderer.render(scene,camera);}
  function raise(value){target=value?1:0;document.querySelector('#mobile-wrist').setAttribute('aria-pressed',String(value));}
  update();load();
  return {raise,toggle(){raise(!target)},update,start(){running=true;last=performance.now();resize();update();renderer.setAnimationLoop(frame)},stop(){running=false;renderer.setAnimationLoop(null)},dispose(){disposed=true;running=false;renderer.setAnimationLoop(null);observer.disconnect();display.dispose();retry.onclick=null;scene.traverse(obj=>{obj.geometry?.dispose();if(obj.material)for(const m of [obj.material].flat())m.dispose();});texture.dispose();renderer.dispose();renderer.domElement.remove();}};
}
