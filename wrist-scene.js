import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { createTerminalTexture } from './terminal-texture.js';

// Web Audio API ile uzay giysisi servo / hidrolik ses sentezleyici
function playServoSound(raising) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    // Servo motor vızıltısı (Oscillator)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    
    // Frekans kayması (Kaldırırken yukarı, indirirken aşağı)
    const now = ctx.currentTime;
    if (raising) {
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.28);
    } else {
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.25);
    }

    oscGain.gain.setValueAtTime(0.04, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    // Düşük geçiren filtre ile kask içi boğuk mekanik ses efekti
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);

    // Beyaz gürültü (Pnömatik hava üflemesi / hiss)
    const bufferSize = ctx.sampleRate * 0.25;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1400, now);
    noiseFilter.Q.setValueAtTime(3, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.035, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(ctx.destination);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
    whiteNoise.start(now);
    whiteNoise.stop(now + 0.3);
  } catch (e) {
    // Ses desteği yoksa sessizce devam et
  }
}

// Z-up, T-pose STL dosyasından astronotun sağ/sol kol geometrisini çıkartır
export function extractArm(source) {
  const data = source.attributes.position;
  const positions = [];
  const scale = 1.8 / 74.2626838684082;
  for (let i = 0; i < data.count; i += 3) {
    if ([0, 1, 2].every(j => data.getX(i + j) > 16.5 && (data.getZ(i + j) + 37.13139343261719) * scale > 1.19 && (data.getZ(i + j) + 37.13139343261719) * scale < 1.47)) {
      for (let j = 0; j < 3; j++) {
        positions.push(
          data.getX(i + j) * scale - 0.40,
          (data.getZ(i + j) + 37.13139343261719) * scale - 1.32,
          -data.getY(i + j) * scale - 0.09
        );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createWristScene(host, getData) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x28323a);
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9b7052, 6, 40);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.02, 90);
  camera.position.y = 1.65;
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0xe6efff, 0x73503b, 3));
  const sun = new THREE.DirectionalLight(0xffdfb1, 3);
  sun.position.set(-4, 7, 3);
  scene.add(sun);

  // Zemin & Mars yüzeyi kayaları
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x966448, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  for (let i = 0; i < 45; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.1 + (i % 5) * 0.04, 0),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x694f41 : 0x82604a, roughness: 1 })
    );
    rock.position.set(Math.sin(i * 17) * 12, 0.08, -2 - i * 0.6);
    rock.scale.y = 0.6;
    scene.add(rock);
  }

  // Kamera içi astronot kolu grubu (Rig)
  const rig = new THREE.Group();
  camera.add(rig);

  // DOĞAL SAATE BAKMA POZLARI (ASTRONOT BİLEĞİ KALDIRMA KİNEMATİĞİ)
  // 1. İndirilmiş (Dinlenme) Pozu: Kol sol altta, görüşün dışında
  const hiddenPos = new THREE.Vector3(-0.35, -0.92, -0.62);
  const hiddenRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, -0.25, -0.55));

  // 2. Kaldırılmış (Saate Bakma) Pozu: Kol göğüs hizasında, saat ekranı doğrudan gözün karşısında
  const shownPos = new THREE.Vector3(-0.25, -0.20, -0.56);
  const shownRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.38, -0.08, 0.28));

  rig.position.copy(hiddenPos);
  rig.quaternion.copy(hiddenRot);

  // 1152 x 710 Yüksek Çözünürlüklü Doku Yüzeyi
  const surface = document.createElement('canvas');
  surface.width = 1152;
  surface.height = 710;
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  // Terminal & Kasa Grubu (14 x 9 cm)
  const terminal = new THREE.Group();
  terminal.position.set(0.17, 0.080, 0.015);
  terminal.rotation.x = -Math.PI / 2;
  rig.add(terminal);

  // Koyu Titanyum Kasa
  const caseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.09, 0.014),
    new THREE.MeshStandardMaterial({ color: 0x20242e, metalness: 0.45, roughness: 0.55 })
  );
  terminal.add(caseMesh);

  // Parlayan Ekran Yüzeyi
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.130, 0.082),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  screen.position.z = 0.0075;
  terminal.add(screen);

  // Bilek Kayışı (Straps)
  const strap = new THREE.Group();
  for (const x of [0.125, 0.215]) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.060, 0.004, 8, 36),
      new THREE.MeshStandardMaterial({ color: 0x262b32, roughness: 0.9 })
    );
    band.rotation.y = Math.PI / 2;
    band.scale.y = 0.90;
    band.position.set(x, 0, 0.015);
    strap.add(band);
  }
  rig.add(strap);

  // Doğrudan 60 FPS Canvas Doku Üreticisi
  const display = createTerminalTexture(canvas => {
    const ctx = surface.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 1152, 710);
    texture.needsUpdate = true;
  });

  let target = 0;       // 0: İndirilmiş, 1: Kaldırılmış
  let amount = 0;       // Geçerli animasyon ilerlemesi (0.0 -> 1.0)
  let running = false;
  let disposed = false;
  let arm;
  let loading = false;
  let last = 0;

  const status = document.querySelector('#model-status');
  const retry = document.querySelector('#model-retry');
  terminal.visible = false;
  strap.visible = false;

  async function load() {
    if (loading || arm || disposed) return;
    loading = true;
    if (status) { status.hidden = false; status.textContent = 'Astronot kolu yükleniyor…'; }
    if (retry) retry.hidden = true;

    try {
      const geometry = await new STLLoader().loadAsync(new URL('./models/astronaut.stl', document.baseURI).href);
      if (disposed) { geometry.dispose(); return; }

      const extracted = extractArm(geometry);
      geometry.dispose();

      arm = new THREE.Mesh(
        extracted,
        new THREE.MeshStandardMaterial({ color: 0xd8d6c6, roughness: 0.85, side: THREE.DoubleSide })
      );
      rig.add(arm);

      // Kol yenini görüşün sol köşesine doğru uzatan astronot giysisi silindiri
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.067, 0.092, 1.05, 16, 8, true),
        arm.material
      );
      sleeve.rotation.z = -Math.PI / 2;
      sleeve.position.set(-0.49, 0, 0.012);
      arm.add(sleeve);

      terminal.visible = true;
      strap.visible = true;
      if (status) status.hidden = true;
    } catch (error) {
      if (status) status.textContent = 'Astronot modeli yüklenemedi. Bağlantıyı kontrol edip tekrar dene.';
      if (retry) retry.hidden = false;
      console.error(error);
    } finally {
      loading = false;
    }
  }

  if (retry) retry.onclick = load;

  function update() {
    const data = getData();
    display.update(data);
  }

  const resize = () => {
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  // KARE ANİMASYON DÖNGÜSÜ (FRAME LOOP)
  function frame(time) {
    if (!running) return;
    const dt = Math.min((time - last) / 1000, 0.05);
    last = time;

    // Yumuşak geçiş hızı (Smooth easing)
    const speed = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1 - Math.exp(-dt * 9.5);
    amount += (target - amount) * speed;

    // 1. Temel Doğrusal İnterpolasyon
    const currentPos = new THREE.Vector3().lerpVectors(hiddenPos, shownPos, amount);

    // 2. Kavisli Kol Hareketi Yayı (Parabolik Arc - Doğal kol kaldırma hissi)
    const arcT = Math.sin(amount * Math.PI);
    currentPos.y += arcT * 0.055; // Kol yukarı kavis çizerek yükselir
    currentPos.x -= arcT * 0.035; // Kol yandan göğse doğru kavisle yaklaşır
    currentPos.z += arcT * 0.025;

    // 3. Astronot Nefes Alma / Mikro Titreşim (Idle Hand Sway)
    if (amount > 0.96 && target === 1) {
      const breathY = Math.sin(time * 0.0018) * 0.0022;
      const breathX = Math.cos(time * 0.0014) * 0.0015;
      currentPos.y += breathY;
      currentPos.x += breathX;
    }

    rig.position.copy(currentPos);

    // 4. Açısal İnterpolasyon (Slerp)
    rig.quaternion.slerpQuaternions(hiddenRot, shownRot, amount);

    // Saate bakarken bileğin hafif canlı dönmesi
    if (amount > 0.96 && target === 1) {
      const breathRoll = Math.sin(time * 0.0015) * 0.005;
      rig.rotation.z += breathRoll;
    }

    rig.visible = amount > 0.005;
    renderer.render(scene, camera);
  }

  function raise(value) {
    const next = value ? 1 : 0;
    if (next !== target) {
      target = next;
      playServoSound(target === 1);
      const mobileBtn = document.querySelector('#mobile-wrist');
      if (mobileBtn) {
        mobileBtn.setAttribute('aria-pressed', String(value));
        mobileBtn.textContent = target === 1 ? 'Kolu İndir' : 'Bileğe Bak (Alt)';
      }
    }
  }

  update();
  load();

  return {
    raise,
    toggle() { raise(!target); },
    update,
    start() {
      running = true;
      last = performance.now();
      resize();
      update();
      renderer.setAnimationLoop(frame);
    },
    stop() {
      running = false;
      renderer.setAnimationLoop(null);
    },
    dispose() {
      disposed = true;
      running = false;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      display.dispose();
      if (retry) retry.onclick = null;
      scene.traverse(obj => {
        obj.geometry?.dispose();
        if (obj.material) {
          for (const m of [obj.material].flat()) m.dispose();
        }
      });
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
