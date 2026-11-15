import {createConsoleTargeter} from './console-target.mjs';
// Facility computers: a console with a live screen beside İhan's air plant, water plant and greenhouse.
// Walk up and press E (or use the "Yaşam destek tesisleri" drawer) to open its control panel; switches
// feed İhan's stepAir/stepWater through src/sim/colonyLifeSupport.js. Running units also show effects:
// exhaust from the air-plant fans, dust and ice chips at the water-plant drill, mist over the grow beds.
import * as T from 'three'
import { roverReadouts } from './rover.mjs' // ROVER

const n = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString('tr-TR', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—'
const STATE = { operational: ['SERA AKTİF', '#7ce0c3'], on: ['ÇALIŞIYOR', '#7ce0c3'], idle: ['BEKLEMEDE', '#e7b25c'], off: ['KAPALI', '#e06c5a'] }
const STATE_COLORS = Object.fromEntries(Object.entries(STATE).map(([key, value]) => [key, new T.Color(value[1])])) // ROVER: reuse lamp colours, no frame allocations.

export const SYSTEMS = {
 habitat:{title:'Yaşam alanı · Sistem tableti',prompt:'E · Yaşam alanı tableti',controls:[],status:t=>t.oxygenKg>0?'on':'off',readouts:t=>[['Mürettebat',String(t.crew)],['Oksijen',n(t.oxygenKg)+' kg'],['Su',n(t.waterL)+' L'],['Kullanılan güç',n(t.powerKW)+' kW']],note:'Mevcut koloni simülasyonundan salt okunur veriler.'},
 solar:{title:'Güneş tarlası · Enerji tableti',prompt:'E · Güneş tarlası tableti',controls:[],status:t=>t.electrical?.live?.production>0?'on':'idle',readouts:t=>[['Güneş üretimi',n(t.electrical?.live?.production)+' kW'],['Batarya',n(t.electrical?.state?.battery)+' / 180 kWh'],['Gece rezervi',n(t.electrical?.live?.reserve)+' kWh'],['AC bara desteği',n(t.electrical?.live?.transferKW)+' kW']],note:'İlhan mikroşebeke modeli · 5 × 36 kWh batarya.'},
  // ROVER: registered by the scene host; shares the facility computer and E interaction.
  rover: {
    title: 'Perseverance · Rover bilgisayarı', prompt: 'E · Rover bilgisayarı', controls: [],
    status: t => t.rover.mode === 'parked' ? 'idle' : 'on',
    readouts: t => roverReadouts(t.rover),
    note: 'NASA/JPL: en çok 0,042 m/sn; MMRTG ≈110 W; iki 43 Ah batarya; 43 tüp (5 tanık). Rover zamanı ×50 hızlandırılmış (oyun varsayımı); [ / ] koloni zaman çarpanı ayrıca uygulanır. Otonom kampanya 280 m keşif halkalarına açılır, bilim yapar ve düşük bataryada üsse döner. Rotalar, yükler, süreler ve bilim verileri eğitsel oyun varsayımlarıdır. SHERLOC adayı yaşam kanıtı sayılmaz.', // ROVER2
  },
  air: {
    title: 'Hava tesisi · O₂ üretimi ve CO₂ temizleme', prompt: 'E · Hava tesisi bilgisayarı',
    status: t => !t.controls.air.fans ? 'off' : t.air.producer ? 'on' : 'idle',
    readouts: t => [
      ['O₂ üretimi', `${n(t.air.producer ? .108 : 0, 3)} kg/sa`],
      ['O₂ tankı', `${n(t.air.oxygenKg)} / 15 kg`],
      ['O₂ rezervi', `${n(t.oxygenHours, 1)} saat`],
      ['Kabin CO₂ (kütle)', `${n(t.air.co2Kg, 3)} kg`],
      ['Temizlenen CO₂', `${n(t.air.removedCO2Kg)} kg`],
      ['Güç', `${n(t.air.powerUsedKW ?? 0)} kW`],
    ],
    controls: [['air', 'fans', 'Fanlar (dolaşım)'], ['air', 'scrubber', 'CO₂ temizleyici'], ['air', 'producer', 'O₂ üretimi · 9× MOXIE']],
    note: 'İhan’ın varsayımı: 0,108 kg O₂/sa ve 2,7 kW, dokuz küçük MOXIE’nin zirve hızı (Perseverance MOXIE en fazla ~12 g/sa üretti). Fanlar kapanırsa dolaşım durur; temizleyici ve üretici de çalışmaz. Mürettebat 3 × 0,84 kg O₂/gün tüketir (NASA BVAD).',
  },
  water: {
    title: 'Su tesisi · buzdan su ve geri kazanım', prompt: 'E · Su tesisi bilgisayarı',
    status: t => t.water.extractor || t.water.recycler ? 'on' : t.controls.water.extract || t.controls.water.recycle ? 'idle' : 'off',
    readouts: t => [
      ['Buzdan çıkarım', `${n(t.water.extractor ? 20 / 6 : 0)} L/sa`],
      ['Temiz su', `${n(t.water.cleanL, 1)} / 100 L`],
      ['Su rezervi', `${n(t.waterDays, 1)} gün`],
      ['Atık su', `${n(t.water.wasteL, 1)} L`],
      ['Geri kazanılan', `${n(t.water.recoveredL, 1)} L`],
      ['Kalan buzlu regolit', `${n(t.water.iceKg, 0)} kg`],
      ['Güç', `${n(t.water.powerUsedKW ?? 0)} kW`],
    ],
    controls: [['water', 'extract', 'Buz matkabı / ısıtıcı'], ['water', 'recycle', 'Atık su geri dönüşümü']],
    note: 'İhan’ın varsayımı: 2 kW ile 20 L / 6 saat; regolitte %50 buz, %80 yakalama. Geri kazanım %85, 0,3 kW, 5 L/sa. Mürettebat 3 × 3,52 L/gün kullanır (NASA BVAD).',
  },
  greenhouse: {
    title: 'Sera · aydınlatma ve sulama', prompt: 'E · Sera bilgisayarı',
    status: () => 'operational',
    readouts: t => [
      ['Mor yetiştirme ışıkları', t.greenhouse.ledOn ? 'Yanıyor' : 'Sönük'],
      ['LED modu', { auto: 'Otomatik', on: 'Sürekli açık', off: 'Kapalı' }[t.controls.greenhouse.led]],
      ['Sulama pompası', t.greenhouse.pumpOn ? 'Çalışıyor' : 'Durdu'],
      ['Tüketim hesabı', 'Sulama / ışık ayrıca modellenmiyor'],
      ['Hava kilidi', { idle: 'Kapalı · basınçlı', cycling: 'Basınç eşitleniyor', 'awaiting-door': 'Kapı bekleniyor' }[t.airlock] ?? '—'],
    ],
    controls: [['greenhouse', 'irrigation', 'Sulama pompası']],
    modes: ['greenhouse', 'led', [['auto', 'Otomatik'], ['on', 'Açık'], ['off', 'Kapalı']]],
    note: 'Mor ışıklar elle açılıp kapatılabilir; otomatik modda yalnızca gece yanar. Sulama isteğe bağlı açılır. Sulama görselleştirilir; su ve sera elektrik tüketimi bu sürümde ayrıca hesaplanmaz. Bitkilerin O₂ katkısı yeterlilik hesabına katılmaz.',
  },
}

for(const id of ['air','water']){SYSTEMS[id].controls=[];delete SYSTEMS[id].modes;SYSTEMS[id].note+=' Bu sürümde ekran salt okunur; mevcut koloni kuralları korunur.';}

function makeScreen() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace
  return { canvas, texture }
}

function drawScreen(screen, id, t) {
  const g = screen.canvas.getContext('2d'), sys = SYSTEMS[id], [label, color] = STATE[sys.status(t)]
  g.fillStyle = '#071219'; g.fillRect(0, 0, 512, 320)
  g.fillStyle = color; g.fillRect(0, 0, 512, 10)
  g.font = '600 30px "Barlow", "Segoe UI", sans-serif'; g.fillStyle = '#e9f3ef'
  g.fillText(sys.title.split(' · ')[0].toUpperCase(), 22, 54)
  g.font = '700 26px "Barlow", "Segoe UI", sans-serif'; g.fillStyle = color; g.fillText('● ' + label, 22, 92)
  g.font = '500 23px "Barlow", "Segoe UI", sans-serif'
  sys.readouts(t).slice(0, 5).forEach(([k, v], i) => {
    g.fillStyle = '#8fb3a8'; g.fillText(k, 22, 136 + i * 36)
    g.fillStyle = '#f2ebe0'; g.textAlign = 'right'; g.fillText(v, 490, 136 + i * 36); g.textAlign = 'left'
  })
  screen.texture.needsUpdate = true
}

function makeConsole(screen) {
  const group = new T.Group()
  const metal = new T.MeshStandardMaterial({ color: 0x3a3f42, metalness: .55, roughness: .45 })
  const pedestal = new T.Mesh(new T.BoxGeometry(.42, 1.0, .34), metal); pedestal.position.y = .5
  const head = new T.Group(); head.position.set(0, 1.12, .02); head.rotation.x = -.55
  const bezel = new T.Mesh(new T.BoxGeometry(.92, .62, .07), metal)
  const display = new T.Mesh(new T.PlaneGeometry(.84, .525), new T.MeshBasicMaterial({ map: screen.texture, toneMapped: false }))
  display.position.z = .037
  const lamp = new T.Mesh(new T.SphereGeometry(.035, 12, 8), new T.MeshStandardMaterial({ color: 0x7ce0c3, emissive: 0x7ce0c3, emissiveIntensity: 2 }))
  lamp.position.set(.39, .34, .02)
  head.add(bezel, display, lamp)
  group.add(pedestal, head)
  group.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true })
  display.castShadow = false
  return { group, lamp, display }
}

// Soft round particle sprite (radial falloff) so puffs read as gas/dust, not square pixels.
let softDisc
function discTexture() {
  if (softDisc) return softDisc
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.45, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  return (softDisc = new T.CanvasTexture(c))
}

// One Points cloud per effect; additive puffs fade by darkening their vertex colour.
function makeEmitter(scene, { count, size, color, additive, spawn, velocity, life }) {
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3)
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3))
  const material = new T.PointsMaterial({ size, map: discTexture(), alphaTest: additive ? 0 : .08, vertexColors: true, transparent: true, depthWrite: false,
    blending: additive ? T.AdditiveBlending : T.NormalBlending, opacity: additive ? 1 : .85, sizeAttenuation: true })
  const points = new T.Points(geometry, material); points.frustumCulled = false
  scene.add(points)
  const age = new Float32Array(count).fill(Infinity), vel = new Float32Array(count * 3), base = new T.Color(color)
  const p = new T.Vector3(), v = new T.Vector3()
  return {
    update(dt, active) {
      for (let i = 0; i < count; i++) {
        age[i] += dt
        if (age[i] > life) {
          if (!active || Math.random() > dt * count / life * 1.2) { colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0; positions[i * 3 + 1] = -100; continue }
          spawn(p, i); velocity(v, i); age[i] = 0
          positions.set([p.x, p.y, p.z], i * 3); vel.set([v.x, v.y, v.z], i * 3)
        }
        positions[i * 3] += vel[i * 3] * dt; positions[i * 3 + 1] += vel[i * 3 + 1] * dt; positions[i * 3 + 2] += vel[i * 3 + 2] * dt
        vel[i * 3 + 1] -= (additive ? 0 : 3.71) * dt // dust falls back at Mars gravity; gas plumes drift
        const fade = additive ? Math.max(0, 1 - age[i] / life) : 1
        colors[i * 3] = base.r * fade; colors[i * 3 + 1] = base.g * fade; colors[i * 3 + 2] = base.b * fade
      }
      geometry.attributes.position.needsUpdate = geometry.attributes.color.needsUpdate = true
    },
    dispose() { points.removeFromParent(); geometry.dispose(); material.dispose() },
  }
}

export function createSystemConsoles({ scene, heightAt, placements, emitters, getTelemetry, setControl }) {
  const consoles = {}
  let rover = null // ROVER
  const readTelemetry = () => { const t = getTelemetry(); if (rover) t.rover = rover.telemetry; return t } // ROVER
  function addConsole(id, at) { // ROVER: also used for the rover parking computer.
    const screen = makeScreen(), { group, lamp, display } = makeConsole(screen)
    group.position.set(at.x, heightAt(at.x, at.z), at.z); group.rotation.y = at.yaw ?? 0
    scene.add(group)
    consoles[id] = { id, at, group, lamp, screen, display }
  }
  for (const [id, at] of Object.entries(placements)) addConsole(id, at) // ROVER
  const rand = () => Math.random() - .5
  const effects = {
    air: makeEmitter(scene, { count: 140, size: .55, color: 0x5a5148, additive: true, life: 3.2,
      spawn: (p, i) => { const e = emitters.airVents[i % emitters.airVents.length]; p.set(e.x + rand() * .3, e.y + .1, e.z + rand() * .3) },
      velocity: v => v.set(rand() * .25 + .35, .9 + Math.random() * .4, rand() * .25) }), // drifts downwind
    water: makeEmitter(scene, { count: 140, size: .11, color: 0xa8754f, additive: false, life: 1.4,
      spawn: p => { const e = emitters.drill; p.set(e.x + rand() * .5, e.y + .12, e.z + rand() * .5) },
      velocity: v => { const a = Math.random() * Math.PI * 2, s = .6 + Math.random() * .9; v.set(Math.cos(a) * s, 1.3 + Math.random() * 1.3, Math.sin(a) * s) } }),
    ice: makeEmitter(scene, { count: 40, size: .06, color: 0xdff4ff, additive: true, life: 1.1,
      spawn: p => { const e = emitters.drill; p.set(e.x + rand() * .3, e.y + .2, e.z + rand() * .3) },
      velocity: v => v.set(rand() * 1.2, 1.4 + Math.random(), rand() * 1.2) }),
    mist: makeEmitter(scene, { count: 140, size: .35, color: 0x3c5566, additive: true, life: 2.2,
      spawn: (p, i) => { const e = emitters.beds[i % emitters.beds.length]; p.set(e.x + rand() * 1.1, e.y, e.z + rand() * 2) },
      velocity: v => v.set(rand() * .1, .12 + Math.random() * .1, rand() * .1) }),
  }

  // Control panel (DOM), styled like the rest of the colony HUD.
  const panel = document.createElement('section')
  panel.id = 'system-console'; panel.className = 'system-console'; panel.hidden = true
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.tabIndex = -1
  panel.innerHTML = `<header><div><span class="sc-eyebrow">TESİS BİLGİSAYARI</span><h2></h2></div>
    <button type="button" class="sc-close" aria-label="Bilgisayarı kapat">×</button></header>
    <div class="sc-status"></div><dl class="sc-readouts"></dl><div class="sc-controls"></div><div class="sc-results"></div><p class="sc-note"></p>
    <p class="sc-hint">Esc · kapat</p>`
  ;(document.querySelector('main') ?? document.body).append(panel)
  let open = null, lastDraw = -1, time = 0
  let roverMode = null, roverMeasurements = -1, roverSamples = -1 // ROVER: immediate completion updates, including advanceTime().
  const abort = new AbortController(), on = (el, type, fn, opts = {}) => el.addEventListener(type, fn, { ...opts, signal: abort.signal })

  function renderControls() {
    const sys = SYSTEMS[open], t = readTelemetry(), box = panel.querySelector('.sc-controls') // ROVER
    box.replaceChildren()
    box.classList.remove('rover-controls') // ROVER
    if (open === 'rover') { rover.renderControls(box, on); return } // ROVER
    if (sys.modes) {
      const [system, key, options] = sys.modes, row = document.createElement('div'); row.className = 'sc-modes'
      row.append(Object.assign(document.createElement('span'), { textContent: 'LED büyüme ışığı' }))
      for (const [value, text] of options) {
        const b = Object.assign(document.createElement('button'), { type: 'button', textContent: text })
        b.setAttribute('aria-pressed', String(t.controls[system][key] === value))
        on(b, 'click', () => { setControl(system, key, value); renderControls() })
        row.append(b)
      }
      box.append(row)
    }
    for (const [system, key, text] of sys.controls) {
      const value = t.controls[system][key]
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'sc-toggle' })
      b.innerHTML = `<span>${text}</span><b>${value ? 'AÇIK' : 'KAPALI'}</b>`
      b.setAttribute('aria-pressed', String(value))
      on(b, 'click', () => { setControl(system, key, !getTelemetry().controls[system][key]); renderControls() })
      box.append(b)
    }
  }
  function renderReadouts() {
    const sys = SYSTEMS[open], t = readTelemetry(), [label, color] = STATE[sys.status(t)] // ROVER
    const status = panel.querySelector('.sc-status'); status.textContent = '● ' + label; status.style.color = color
    panel.querySelector('.sc-readouts').replaceChildren(...sys.readouts(t).flatMap(([k, v]) =>
      [Object.assign(document.createElement('dt'), { textContent: k }), Object.assign(document.createElement('dd'), { textContent: v })]))
    if (open === 'rover') rover.renderResults(panel.querySelector('.sc-results')) // ROVER
  }
  function show(id) {
    if(id==='solar'){window.dispatchEvent(new CustomEvent('colony:power-open'));return;}
    if (!consoles[id]) return // ROVER
    open = id
    panel.dataset.system = id
    panel.querySelector('.sc-results').replaceChildren(); panel.querySelector('.sc-results').className = 'sc-results' // ROVER
    panel.querySelector('.sc-eyebrow').textContent = id === 'rover' ? 'MARS 2020 / YÜZEY BİLİMİ' : 'TESİS BİLGİSAYARI' // ROVER
    if (document.pointerLockElement) document.exitPointerLock()
    panel.querySelector('h2').textContent = SYSTEMS[id].title
    panel.querySelector('.sc-note').textContent = SYSTEMS[id].note
    const results=panel.querySelector('.sc-results'),controls=panel.querySelector('.sc-controls');if(id==='rover'){panel.insertBefore(controls,panel.querySelector('.sc-status'));panel.insertBefore(results,panel.querySelector('.sc-status'));}else{panel.insertBefore(results,panel.querySelector('.sc-note'));panel.insertBefore(controls,results);}
    renderControls(); renderReadouts()
    panel.hidden=false;window.dispatchEvent(new CustomEvent('colony:tablet-panel',{detail:{panel}}));panel.focus({preventScroll:true})
  }
  function close(){open=null;panel.hidden=true;window.dispatchEvent(new CustomEvent('colony:tablet-panel-closed'));}
  on(panel.querySelector('.sc-close'),'click',close);on(window,'colony:tablet-dismiss',()=>{open=null;panel.hidden=true;});on(window,'colony:open-rover',()=>show('rover'));on(window,'colony:open-system',e=>{if(SYSTEMS[e.detail?.id])show(e.detail.id);});
  on(document, 'keydown', e => { if (open && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close() } }, { capture: true })
  for (const b of document.querySelectorAll('[data-console]')) on(b, 'click', () => show(b.dataset.console))

  const targetConsole=createConsoleTargeter();
  const nearest=camera=>targetConsole(Object.values(consoles),camera);

  return {
    registerRover(adapter) { rover = adapter; addConsole('rover', { x: 3.6, z: 16.3, yaw: .35 }) }, // ROVER
    get open() { return open },
    prompt: camera => {const c=nearest(camera);return c?SYSTEMS[c.id].prompt:''},
    interact(camera) { const c = nearest(camera); if (!c) return false; show(c.id); return true },
    show, close,
    blocks: (x, z, hx = .3, hz = .3) => Object.values(consoles).some(c => Math.abs(x - c.group.position.x) < .35 + hx && Math.abs(z - c.group.position.z) < .3 + hz),
    update(dt) {
      time += dt
      const t = readTelemetry() // ROVER
      effects.air.update(dt, Boolean(t.air.producer || t.air.scrubber))
      effects.water.update(dt, Boolean(t.water.extractor))
      effects.ice.update(dt, Boolean(t.water.extractor))
      effects.mist.update(dt, Boolean(t.greenhouse.pumpOn))
      for (const c of Object.values(consoles)) {
        const state = SYSTEMS[c.id].status(t), color = STATE_COLORS[state] // ROVER
        c.lamp.material.color.copy(color); c.lamp.material.emissive.copy(color)
        c.lamp.material.emissiveIntensity = state === 'on' ? 2 : 1 + Math.sin(time * 6) // idle/off lamps blink
      }
      // ROVER: deterministic stepping must leave the final control state immediately usable.
      if (open === 'rover' && (roverMode !== t.rover.mode || roverMeasurements !== t.rover.measurements.length || roverSamples !== t.rover.samples.length)) {
        roverMode = t.rover.mode; roverMeasurements = t.rover.measurements.length; roverSamples = t.rover.samples.length
        renderReadouts()
      }
      if (time - lastDraw > .25) {
        lastDraw = time
        for (const c of Object.values(consoles)) drawScreen(c.screen, c.id, t)
        if (open) renderReadouts()
      }
    },
    dispose() {
      abort.abort(); panel.remove()
      for (const e of Object.values(effects)) e.dispose();softDisc?.dispose();softDisc=null
      for (const c of Object.values(consoles)) { c.group.removeFromParent(); c.group.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose() }) }
    },
  }
}
