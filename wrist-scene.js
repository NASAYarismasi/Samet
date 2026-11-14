import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// Z-up, T-pose STL has no bones. Retain its actual positive-X arm triangles.
export function extractArm(source) {
  const data=source.attributes.position,positions=[],scale=1.8/74.2626838684082;
  for(let i=0;i<data.count;i+=3)if([0,1,2].every(j=>data.getX(i+j)>12 && (data.getZ(i+j)+37.13139343261719)*scale>1.19 && (data.getZ(i+j)+37.13139343261719)*scale<1.47)){
    for(let j=0;j<3;j++)positions.push(data.getX(i+j)*scale,(data.getZ(i+j)+37.13139343261719)*scale,-data.getY(i+j)*scale);
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
  const hidden=new THREE.Vector3(-.65,-2.0,-.85),shown=new THREE.Vector3(-.65,-1.50,-.95);rig.position.copy(hidden);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const terminal=new THREE.Group();terminal.position.set(.60,1.31,.205);terminal.rotation.set(-.12,.08,0);rig.add(terminal);
  terminal.add(new THREE.Mesh(new THREE.BoxGeometry(.25,.135,.035),new THREE.MeshStandardMaterial({color:0x283737,metalness:.35,roughness:.65})));
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(.226,.113),new THREE.MeshBasicMaterial({map:texture}));screen.position.z=.018;terminal.add(screen);
  const strap=new THREE.Mesh(new THREE.BoxGeometry(.065,.17,.12),new THREE.MeshStandardMaterial({color:0x354345}));strap.position.set(.60,1.31,.14);rig.add(strap);
  let target=0,amount=0,running=false,disposed=false,arm,loading=false,last=0;
  const status=document.querySelector('#model-status'),retry=document.querySelector('#model-retry');terminal.visible=false;strap.visible=false;
  async function load(){
    if(loading||arm||disposed)return;loading=true;status.hidden=false;status.textContent='Astronot modeli yükleniyor…';retry.hidden=true;
    try{
      const geometry=await new STLLoader().loadAsync(new URL('./models/astronaut.stl',document.baseURI).href);
      if(disposed){geometry.dispose();return;}
      const extracted=extractArm(geometry);geometry.dispose();
      arm=new THREE.Mesh(extracted,new THREE.MeshStandardMaterial({color:0xd8d6c6,roughness:.85,side:THREE.DoubleSide}));rig.add(arm);
      terminal.visible=true;strap.visible=true;status.hidden=true;
    }catch(error){status.textContent='Astronot modeli yüklenemedi. Bağlantını kontrol edip yeniden dene.';retry.hidden=false;console.error(error);}finally{loading=false;}
  }
  retry.onclick=load;
  function wrap(text,x,y,width,lineHeight,font,color){ctx.font=font;ctx.fillStyle=color;let line='';for(const word of text.split(' ')){if(ctx.measureText(line+word).width>width){ctx.fillText(line,x,y);y+=lineHeight;line='';}line+=word+' ';}ctx.fillText(line,x,y);}
  function update(){
    const data=getData();renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label',`Bilek terminali. Batarya ${data.resources.energy}, su ${data.resources.water}, oksijen ${data.resources.oxygen}, yiyecek ${data.resources.food}. Gorev: ${data.mission}`);ctx.fillStyle='#10231f';ctx.fillRect(0,0,1024,512);ctx.fillStyle='#aecfbb';ctx.font='22px monospace';ctx.fillText('ARES / EVA',35,38);
    [['energy','BATARYA'],['water','SU'],['oxygen','OKSİJEN'],['food','YİYECEK']].forEach(([key,label],i)=>{
      const x=35+(i%2)*290,y=96+Math.floor(i/2)*174,value=data.resources[key];ctx.fillStyle='#bfd6c7';ctx.font='25px sans-serif';ctx.fillText(label,x,y);
      ctx.fillStyle=value<=30?'#efb475':'#dbf4df';ctx.font='52px monospace';ctx.fillText(String(value),x,y+61);
      ctx.fillStyle='#3b5345';ctx.fillRect(x,y+86,235,8);ctx.fillStyle=value<=30?'#efb475':'#a6d6b1';ctx.fillRect(x,y+86,235*value/100,8);
    });
    ctx.fillStyle='#5a7461';ctx.fillRect(615,68,2,372);ctx.fillStyle='#b1cbb9';ctx.font='24px sans-serif';ctx.fillText('AKTİF GÖREV',650,97);
    wrap(data.mission,650,158,330,39,'31px sans-serif','#e0efdf');wrap('→ '+data.objective,650,290,330,32,'23px sans-serif','#ddcda4');texture.needsUpdate=true;
  }
  const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);
  function frame(time){if(!running)return;const dt=Math.min((time-last)/1000,.05);last=time;const speed=window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:1-Math.exp(-dt*11);amount+=(target-amount)*speed;rig.position.lerpVectors(hidden,shown,amount);rig.rotation.z=THREE.MathUtils.lerp(.25,-.09,amount);rig.visible=amount>.005;renderer.render(scene,camera);}
  function raise(value){target=value?1:0;document.querySelector('#mobile-wrist').setAttribute('aria-pressed',String(value));}
  update();load();
  return {raise,toggle(){raise(!target)},update,start(){running=true;last=performance.now();resize();update();renderer.setAnimationLoop(frame)},stop(){running=false;renderer.setAnimationLoop(null)},dispose(){disposed=true;running=false;renderer.setAnimationLoop(null);observer.disconnect();retry.onclick=null;scene.traverse(obj=>{obj.geometry?.dispose();if(obj.material)for(const m of [obj.material].flat())m.dispose();});texture.dispose();renderer.dispose();renderer.domElement.remove();}};
}
