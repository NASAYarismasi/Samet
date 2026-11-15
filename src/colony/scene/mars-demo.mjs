import {COMMS_PAD} from '../../data/colonyLayout.js';
import {createRover} from './rover.mjs';
import {createCommsStation} from '../ihan/comms-station.mjs';
import * as T from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { moduleModel } from "./mars-models.mjs"
import { createFirstPerson, placeholderAstronaut } from "./mars-fps.mjs"
// IHAN-SRC: real ?han source replaces recovered construction.
import { createOvaWorld } from '../ihan/crater-ecosystem.mjs'
import { createOvaNavigation } from '../ihan/navigation.mjs'
import { prepareOvaRover } from '../ihan/assets.mjs'
// IHAN-SRC: installation host; no standalone renderer or loop.
import { createLifeSupportFacilities } from '../ihan/life-support.mjs'
import { createEnvironment } from "./environment.mjs"
import { createFootprints } from "./surface.mjs"
import { createCrewAgents } from "./crew-npc.mjs"
import { batchStaticModel, prepareSurfaceMaterials, batchStaticLeaves } from "./static-model.mjs"
import { createMarsLander } from "../../render/marsLander.js"
import { cargoOptions, defaultManifest, planMission, cargoLimitKg, transitDays } from "../mars-gorev-plani.mjs"
import { createSceneColony } from "./mission-start.mjs"
import { materialNames, nodes, crops, recipes, levelOf, startWorkshop, recipeError,
  craft, collect, grow, harvest, replant, sell } from "../mars-atolye.mjs"
import { modules, roles, exampleLanding, missionLength, createColonyFromFlight,
  footprints, roofSize, worldPlacement,
  placementError, placeModule, assignAstronaut, advanceSol, colonyReport } from "../mars-koloni.mjs"
import { readLandingPayload } from "../handoff.js"

const byId = id => document.getElementById(id)
const status = byId("message")
const viewport = byId("viewport")
const canvas = byId("scene")
const uiLifecycle = new AbortController()
// Integration (Emre): the colony starts from the flight's real landing payload when one exists.
let landing = readLandingPayload(exampleLanding)
let activeMissionPlan = landing.source === "flight" ? undefined : planMission(defaultManifest)
// Flight payload = crew-sols → person-sols via İhan's createColonyFromFlight.
const startColony = () => createSceneColony(landing, activeMissionPlan)
let state = startColony()
let workshop = startWorkshop()
let selected
let fpsEntered = false // first FPS entry starts at the lander; later entries resume in place
let playerId = state.crew[0].id
let sceneView
let lastReport = colonyReport(state)
const labels = { habitat: "Yaşam alanı", water: "Su", oxygen: "Oksijen", food: "Yiyecek", cleanAir: "CO₂ giderimi" }

const pick = () => { selected=undefined } // Construction placement is disabled.

function makeScene() {
  const lifecycle = new AbortController()
  window.addEventListener('colony:power-command',event=>{
    const {key,value}=event.detail??{};
    if(['closed','drill','lamp','blackStart'].includes(key)&&typeof value==='boolean')lifeSupport.power.controls[key]=value;
    if(key==='season'&&[0,90,180,270].includes(value))lifeSupport.power.controls.season=value;
    if(key==='forecast')window.dispatchEvent(new CustomEvent('colony:power-report',{detail:lifeSupport.power.forecast()}));
  },{signal:lifecycle.signal})
  window.addEventListener('colony:analyze-soil',()=>ova.analyzeSoil(),{signal:lifecycle.signal})
  const listenerOptions = { signal: lifecycle.signal }
  let disposed = false
  // high-performance: on dual-GPU laptops (e.g. AMD iGPU + RTX 3050) this asks the browser for the discrete GPU.
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFShadowMap
  renderer.toneMapping = T.ACESFilmicToneMapping
  const scene = new T.Scene()
  const camera = new T.PerspectiveCamera(48, 1, .08, 50000)
  camera.position.set(29, 35, 35)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2 - .015
  controls.minDistance = 2
  controls.maxDistance = 380
  const environment = createEnvironment(scene, camera, canvas)
  const ova = createOvaWorld(scene)
  const comms=createCommsStation(scene,(x,z)=>ova.ground.userData.heightAt(x,z));
  // Host perf: İhan's domes/tunnels (~330 parts) and the 108 horizon mounds never move -> per-material batches.
  for (const root of [scene.getObjectByName('Ihan_pressurised_habitat'), ...scene.children.filter(o => o.isGroup && o.children.length > 50 && o.children.every(c => c.isMesh && !c.children.length))]) if (root) { const moving=new Set(); for(const lock of ova.locks) for(const leaf of [lock.inner,lock.outer])leaf.traverse(o=>moving.add(o));const privacy=root.getObjectByName("PrivacyDoor");if(privacy)privacy.traverse(o=>moving.add(o)); batchStaticLeaves(root,moving) }
  const navigation = createOvaNavigation(ova)
  const ground = ova.ground
  let currentView = 'panorama'
  function groundY(x, z) {
    return ground.userData.heightAt(x, z)
  }
  // IHAN-SRC: keep real facilities outside the dome/lander clearances.
  const lifeSupport = createLifeSupportFacilities(scene, groundY, state)
  Object.assign(ova.views, lifeSupport.views)
  ova.views.comms={position:[-16,12,30],target:[COMMS_PAD.x,6,COMMS_PAD.z]};
  const tracks = createFootprints(scene, groundY)
  const crewLander = batchStaticModel(createMarsLander())
  // Arrival apron north-west of the colony: the +Z hatch exits toward the pad.
  crewLander.position.set(-18, groundY(-18, -12), -12)
  crewLander.userData.radius = 7.5 // GAME ASSUMPTION: construction clearance around the landing legs.
  scene.add(crewLander)
  const roofGeometry = new T.BoxGeometry(roofSize.x * 2, .15, roofSize.z * 2)
  const roofMaterial = new T.MeshStandardMaterial({ color: 0x747875, metalness: .35, roughness: .68 })
  const roofMark = new T.MeshBasicMaterial({ color: 0xdfab5d, polygonOffset: true, polygonOffsetFactor: -1 })
  const railLong = new T.BoxGeometry(roofSize.x * 2, .025, .035)
  const railShort = new T.BoxGeometry(.035, .025, roofSize.z * 2)
  const postGeometry = new T.BoxGeometry(.085, 1, .085)
  const foundationGeometry = new T.BoxGeometry(1, 1, 1)
  let roofHeight = 2.16

  const objects = new T.Group()
  const deposits = new T.Group()
  const depositMeshes = new Map()
  const oreMaterial = new T.MeshStandardMaterial({ color: 0xaa7959, roughness: .86, flatShading: true })
  const iceMaterial = new T.MeshStandardMaterial({ color: 0x8cb0b9, roughness: .48, flatShading: true })
  const depositGeometry = new T.DodecahedronGeometry(.64, 0)
  depositGeometry.computeBoundingBox()
  // Team decision 2026-11-14: no mining/collecting on the surface. İhan's rule file keeps its
  // deposit list; the scene simply places none.
  const surfaceDeposits = []
  for (const node of surfaceDeposits) {
    const rock = new T.Mesh(depositGeometry,
      node.material === "ice" ? iceMaterial : oreMaterial)
    rock.scale.set(1.24, .57, .94)
    // Bury the narrow lower facets so outcrops have broad contact with the regolith.
    rock.position.set(node.x, groundY(node.x, node.z) - depositGeometry.boundingBox.min.y * rock.scale.y - .16, node.z)
    rock.rotation.y = node.x
    rock.userData.deposit = node
    rock.castShadow = true
    depositMeshes.set(node.id, rock)
    deposits.add(rock)
  }
  const reference = new T.Group()
  reference.position.set(5.75, .02, 14.5)
  reference.rotation.y = -.6
  scene.add(objects, deposits, reference)
  const roverAgent=createRover({scene,reference,heightAt:groundY,reserveEnergy:kWh=>lifeSupport.reserveChargingEnergy(kWh),focus:(x,z)=>{if(fps.active)fps.setActive(false);currentView='rover';reference.visible=true;camera.position.set(x+9,groundY(x,z)+6.5,z+11);controls.target.set(x,groundY(x,z)+1,z);controls.update();}});
  lifeSupport.consoles.registerRover(roverAgent);

  const crewModels = new Map()
  const loadedCharacters = new Set()
  const retiredCharacters = []
  let teamCharacter
  const crewActor = id => crewModels.get(state.crew.findIndex(person => person.id === id))
  const crewColors = [0xd9d2bf, 0xb88052, 0xa9b9c2]
  state.crew.forEach((person, index) => {
    const actor = new T.Group()
    actor.position.set([-2.1, -5.4, -2.1][index], 0, [16.1, 13.9, 16.1][index])
    actor.position.y = groundY(actor.position.x, actor.position.z)
    actor.rotation.y = .12
    actor.add(placeholderAstronaut(crewColors[index]))
    scene.add(actor)
    crewModels.set(index, actor)
  })
  // Astronauts the player is not controlling work at the base installations (label above helmet).
  const crewAgents = createCrewAgents({ crewModels, groundY })
  const models = new Map()
  function model(type) {
    if (!models.has(type)) models.set(type, moduleModel(type))
    return models.get(type).clone()
  }
  const roofs = new Map()
  const preview = new T.Group()
  scene.add(preview)
  let dragStart
  let lastPointer
  const ray = new T.Raycaster()
  const pointer = new T.Vector2()
  const aimLabel = byId("aim")
  const groundObstacles = []
  const hardware = [crewLander]
  const marker = new T.Mesh(new T.RingGeometry(.17, .23, 24),
    new T.MeshBasicMaterial({ color: 0x9cf2bd, side: T.DoubleSide, depthTest: false }))
  marker.rotation.x = -Math.PI / 2
  marker.visible = false
  marker.renderOrder = 10
  scene.add(marker)
  const outline = new T.Box3Helper(new T.Box3(), 0xa5f6bf)
  outline.visible = false
  outline.material.depthTest = false
  outline.renderOrder = 10
  scene.add(outline)
  let previewType
  let localPreviewBounds
  let roofAccess
  function occupied(x, z, buffer = 0) {
    return groundObstacles.some(area =>
      Math.abs(x - area.x) < area.halfX + buffer && Math.abs(z - area.z) < area.halfZ + buffer)
  }
  function collides(x, z) {
    // IHAN-SRC: greenhouse uses its original interior/airlock bounds.
    if (lifeSupport.inside) return lifeSupport.collides(x,z)
    if (lifeSupport.collides(x,z)) return true
    if (navigation.inside) return navigation.collides(x,z)
    if (roofAccess) return true
    if (navigation.collides(x,z)) return true
    if (occupied(x, z, .31)) return true
    if(Math.hypot(x-COMMS_PAD.x,z-COMMS_PAD.z)<COMMS_PAD.radius)return true;
    if(reference.visible&&reference.children.length&&Math.hypot(x-reference.position.x,z-reference.position.z)<1.85)return true;
    // Metre-scale hull radius 5.8 + suited shoulder clearance. Keep the camera
    // outside the belly/engine envelope while allowing the +Z ladder approach.
    if (Math.hypot(x - crewLander.position.x, z - crewLander.position.z) < 6.18) return true
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const foot = 8.5 / Math.sqrt(2)
      if (Math.hypot(x - crewLander.position.x - sx * foot, z - crewLander.position.z - sz * foot) < 1.48) return true
      const dx = x - crewLander.position.x, dz = z - crewLander.position.z
      const along = (sx * dx + sz * dz) / Math.sqrt(2)
      const across = Math.abs(sx * dx - sz * dz) / Math.sqrt(2)
      if (along > 4.5 && along < 8.7 && across < .52) return true
    }
    for (const actor of crewModels.values()) {
      if (actor.visible && Math.hypot(x - actor.position.x, z - actor.position.z) < .63) return true
    }
    return false
  }

  function targetAt(event) {
    if (event) {
      const bounds = canvas.getBoundingClientRect()
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
        1 - (event.clientY - bounds.top) / bounds.height * 2)
    } else pointer.set(0, 0)
    camera.updateMatrixWorld()
    ray.setFromCamera(pointer, camera)
    const hits = ray.intersectObjects([ova.habitat, ground, objects, deposits, ...hardware.filter(asset => asset.visible)], true)
    const hit = hits.find(hit => hit.object.visible)
    if (!hit || (fps.active && hit.distance > 14)) return null
    if (hit.object.userData.deposit) {
      return { deposit: hit.object.userData.deposit, distance: hit.distance }
    }
    let owner = hit.object
    while (owner && !owner.userData.module && owner !== scene) owner = owner.parent
    const item = owner?.userData.module
    const surface = hit.object.userData.roofId && hit.point.y >= hit.object.userData.top - .02
      ? "roof" : hit.object === ground ? "ground" : "blocked"
    return { item, surface, position: { x: hit.point.x, z: hit.point.z, supportId: hit.object.userData.roofId }, y: hit.point.y }
  }

  function inspect(target) {
    if (!target) return { error: "Kurulum için uygun bir yüzeye bak." }
    if (target.surface === "blocked") return { error: "Zemini veya yaşam modülünün üstündeki montaj alanını hedefle." }
    if (navigation.inside) return {error:'İç mekânda modül kurulamaz. Hava kilidinden dışarı çık.'}
    const error = placementError(state, selected, target.position)
    if (error) return { error }
    const type = state.inventory.find(item => item.id === selected).type
    const { x, z, supportId } = target.position
    const size = footprints[type]
    if (!supportId) {
      if (ova.blocksFootprint(x,z,size.x,size.z) || lifeSupport.blocksFootprint(x,z,size.x,size.z)) { // IHAN-SRC
        return {error:'Üs yapıları ve güneş tarlası çevresini açık bırak.'}
      }
      if (hardware.some(asset => asset.visible && Math.abs(x - asset.position.x) < size.x + asset.userData.radius &&
        Math.abs(z - asset.position.z) < size.z + asset.userData.radius)) return { error: "NASA aracına çok yakın." }
      if (surfaceDeposits.some(node => Math.abs(x - node.x) < size.x + .7 && Math.abs(z - node.z) < size.z + .7)) {
        return { error: "Kaynak yatağının çevresini açık bırak." }
      }
      if (fps.active && Math.abs(camera.position.x - x) < size.x + .31 &&
          Math.abs(camera.position.z - z) < size.z + .31) return { error: "Yerleştirmek için bir adım geri çık." }
      if ([...crewModels.values()].some(actor => actor.visible &&
          Math.abs(actor.position.x - x) < size.x + .3 && Math.abs(actor.position.z - z) < size.z + .3)) {
        return { error: "Bu noktada bir astronot var." }
      }
      return { y: foundationHeight(x, z, size), type }
    }
    return { y: roofs.get(supportId).userData.top, type }
  }

  function drawTarget(target) {
    selected=undefined; // No construction cursor or placement ghost.
    const deposit = target?.deposit
    const crop = crops[target?.item?.type]
    const candidate = selected ? inspect(deposit ? null : target) : {}
    const show = Boolean(target && selected && !deposit)
    marker.visible = show
    outline.visible = show && !candidate.error
    if (show) {
      const { x, z } = target.position
      marker.position.set(x, target.y + .035, z)
      marker.material.color.setHex(candidate.error ? 0xf79580 : 0xa5f6bf)
      if (!candidate.error) {
        if (previewType !== candidate.type || !preview.children.length) {
          preview.clear()
          const ghost = model(candidate.type)
          ghost.traverse(part => {
            if (!part.isMesh) return
            part.material = ghostMaterial
          })
          preview.add(ghost)
          previewType = candidate.type
          preview.position.set(0, 0, 0)
          preview.updateMatrixWorld(true)
          localPreviewBounds = new T.Box3().setFromObject(ghost)
        }
        preview.position.set(x, candidate.y + .008, z)
        preview.updateMatrixWorld(true)
        outline.box.copy(localPreviewBounds).translate(preview.position)
      }
    }
    preview.visible = outline.visible
    if (fps.active) {
      const canAccess = target?.item?.type === "habitat" && !roofAccess
      const label = deposit
        ? materialNames[deposit.material] + (target.distance > 8 ? " · Yaklaş" : " · E ile topla")
        : crop ? modules[target.item.type].name + " · " +
          (workshop.growing[target.item.id] === null ? "E ile yeni dönem başlat" :
            workshop.growing[target.item.id] >= crop.sols ? "E ile hasat et" :
            (workshop.growing[target.item.id] ?? 0) + "/" + crop.sols + " üretim solu")
        : target?.item && (target.surface === "blocked" || !selected)
        ? modules[target.item.type].name + (canAccess ? " · R ile çatı görüşü" : "")
        : show ? candidate.error ?? (target.position.supportId ? "E · Çatıya monte et" : "E · Zemine yerleştir") : ""
      // IHAN-SRC: greenhouse airlock prompt takes priority near its own doors.
      const airlock = ova.solar.prompt(camera) || lifeSupport.prompt(camera) || navigation.prompt(camera.position.x,camera.position.z,camera) || label
      if (aimLabel.textContent !== airlock) aimLabel.textContent = airlock

    }
  }

  function commit(target) {
    if (target?.deposit) {
      if (fps.active && target.distance > 8) {
        status.textContent = "Toplamak için yatağa yaklaş."
        return
      }
      workshopAction(() => {
        workshop = collect(workshop, target.deposit.id, state.sol)
        return "+" + target.deposit.amount + " " + materialNames[target.deposit.material] + " · +2 madencilik XP"
      })
      return
    }
    if (crops[target?.item?.type]) {
      tendCrop(target.item)
      return
    }
    if (!selected) return
    const candidate = inspect(target)
    if (candidate.error) { status.textContent = candidate.error; return }
    pick(target.position)
  }

  const ghostMaterial = new T.MeshBasicMaterial({ color: 0x7cf6c4, transparent: true, opacity: .32,
    depthWrite: false })
  const fps = createFirstPerson(canvas, camera, {
    onMode(active) {
      roofAccess = undefined
      navigation.reset()
      controls.enabled = !active
      if (active) {
        currentView = 'astronaut'
        if (!fpsEntered) fps.teleport(camera.position, -.04, arrivalYaw) // first entry: face the domes
        fpsEntered = true
      }
      environment.setFPS(active)
      viewport.classList.toggle("fps", active)
      byId("view-mode").textContent = active ? "Üs planına dön" : "Astronotun gözünden gez"
      byId("view-help").textContent = active
        ? "WASD Yürü · Shift Hızlan · Boşluk Zıpla · E Etkileşim · R Çatı · L Lamba · Esc Fareyi bırak"
        : "Modülü seç ve zeminde veya çatıda istediğin noktaya tıkla · Sürükleyerek döndür"
      lastPointer = undefined
      redrawScene()
    },
    onAim: () => drawTarget(targetAt()),
    interact: () => {
      // IHAN-SRC: E -> chamber -> pressure cycle -> E -> second door.
      if (ova.solar.interact(camera)) return
      if (lifeSupport.interact(camera, fps)) return
      const transition = navigation.interact(camera.position.x,camera.position.z,camera)
      if (transition) {
        fps.teleport(new T.Vector3(transition.x,transition.y+1.65,transition.z),0,transition.yaw)
        status.textContent=transition.message
        return
      }
      if (!navigation.inside) commit(targetAt())
    },
    accessRoof(lookFrom) {
      if (roofAccess) {
        lookFrom(roofAccess, -.22)
        roofAccess = undefined
        return
      }
      const target = targetAt()
      const roof = target?.item?.type === "habitat" && roofs.get(target.item.id)
      if (!roof) {
        status.textContent = "Çatıya erişmek için yaşam modülüne yaklaş ve bak."
        return
      }
      roofAccess = camera.position.clone()
      roofAccess.top = roof.userData.top
      const { x, z } = worldPlacement(target.item)
      lookFrom(new T.Vector3(x, roof.userData.top + 1.65, z), -1.47)
      status.textContent = "Nişanı çatıda istediğin noktaya getir. E ile yerleştir, R ile in."
    },
    collides,
    groundY: (x, z) => lifeSupport.inside ? lifeSupport.floorY : navigation.inside ? ova.floorY : roofAccess ? roofAccess.top : groundY(x, z),
    onStep(x, z, yaw, running) {
      if (!roofAccess && !navigation.inside) tracks.step(x, z, yaw)
      environment.step(running)
    },
  })
  // Crew arrives beside the +Z hatch ladder; avoid respawning inside the landing legs.
  const hatchSpawn = new T.Vector3(crewLander.position.x, 0, crewLander.position.z + 9) // in front of the +Z ladder, clear of the diagonal legs
  // Face İhan's dome complex (centred on the origin); camera forward is (-sin yaw, -cos yaw).
  const arrivalYaw = Math.atan2(hatchSpawn.x, hatchSpawn.z)
  crewActor(playerId).position.set(hatchSpawn.x, groundY(hatchSpawn.x, hatchSpawn.z), hatchSpawn.z)
  fps.respawn(hatchSpawn, arrivalYaw)
  canvas.addEventListener("pointermove", event => {
    if (fps.active) return
    lastPointer = event
    drawTarget(targetAt(event))
  }, listenerOptions)
  canvas.addEventListener("pointerleave", () => {
    if (!fps.active) { lastPointer = undefined; drawTarget(null) }
  }, listenerOptions)
  canvas.addEventListener("pointerdown", event => { dragStart = [event.clientX, event.clientY] }, listenerOptions)
  canvas.addEventListener("pointerup", event => {
    if (fps.active || event.button !== 0 || !dragStart || Math.hypot(event.clientX - dragStart[0], event.clientY - dragStart[1]) > 5) return
    commit(targetAt(event))
  }, listenerOptions)
  const observer = new ResizeObserver(() => {
    const { clientWidth, clientHeight } = viewport
    if (!clientWidth || !clientHeight) return
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(clientWidth, clientHeight, false)
  })
  observer.observe(viewport)
  const taskObserver = new MutationObserver(() => environment.sync(state, status.textContent))
  taskObserver.observe(status, { childList: true, characterData: true, subtree: true })
  let previousTime, manualTime = false
  const gl = renderer.getContext()
  let gpuFence = null, submittedAt = 0
  const frameStats = { cpuMs: 0, gpuMs: 0, calls: 0, triangles: 0, programs: 0 }
  function gpuReady() {
    if (!gpuFence) return true
    if (gl.clientWaitSync(gpuFence, 0, 0) === gl.TIMEOUT_EXPIRED) return false
    frameStats.gpuMs = performance.now() - submittedAt
    gl.deleteSync(gpuFence); gpuFence = null
    return true
  }
  function renderFrame() {
    // Software WebGL can submit frames much faster than it can rasterize them.
    // One frame in flight keeps screenshots/input responsive instead of queuing
    // minutes of terrain/shadow work behind a fast requestAnimationFrame loop.
    if (!gpuReady()) return
    const start = performance.now()
    renderer.render(scene, camera)
    frameStats.cpuMs = performance.now() - start
    frameStats.calls = renderer.info.render.calls
    frameStats.triangles = renderer.info.render.triangles
    frameStats.programs = renderer.info.programs.length
    gpuFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
    submittedAt = performance.now(); gl.flush()
  }
  function tick(delta, updateAim = true) {
    environment.update(delta)
    ova.updateLab(delta)
    comms.update(delta);
    const roverX=reference.position.x,roverY=reference.position.y,roverZ=reference.position.z;
    roverAgent.update(delta,environment.telemetry.warp,camera);
    if(currentView==='rover'){camera.position.x+=reference.position.x-roverX;camera.position.y+=reference.position.y-roverY;camera.position.z+=reference.position.z-roverZ;controls.target.x+=reference.position.x-roverX;controls.target.y+=reference.position.y-roverY;controls.target.z+=reference.position.z-roverZ;}
    // IHAN-SRC: drive vendor calculations from the same Mars clock, including warp.
    lifeSupport.update(delta, environment.telemetry, camera, fps)
    const habitatTransition=navigation.update(delta); if(habitatTransition)fps.teleport(new T.Vector3(habitatTransition.x,habitatTransition.y+1.65,habitatTransition.z),0,habitatTransition.yaw)
    ova.solar.framePower(delta,lifeSupport.power.telemetry.dust);
    environment.setLifeSupport({...lifeSupport.telemetry,lab:ova.soilAnalysis})
    if(Math.floor(environment.telemetry.unixSeconds)!==ova.lastScreenSecond){ova.lastScreenSecond=Math.floor(environment.telemetry.unixSeconds);ova.updateLifeDisplays(lifeSupport.telemetry)}
    tracks.update(delta)
    crewAgents.update(delta, { state, playerId, fpsActive: fps.active, camera, speed: environment.telemetry.warp })
    if (fps.active) fps.update(delta, updateAim)
    else controls.update()
    scene.updateMatrixWorld()
  }
  renderer.setAnimationLoop(time => {
    const delta = Math.min(.05, (time - (previousTime ?? time)) / 1000)
    previousTime = time
    if (!manualTime) { tick(delta); renderFrame() }
  })
  // Preserve the same deterministic observation/stepping hooks as the flight scene.
  const previousTextHook = window.render_game_to_text, previousAdvanceHook = window.advanceTime
  window.render_game_to_text = () => JSON.stringify({
    scene: "colony", coordinates: "metres; +X east, +Y up, -Z north", state,
    storm: Boolean(state.timeline.at(-1)?.storm), activeTask: status.textContent,
    world:'duz-ova', view:currentView, insideHabitat:navigation.inside, assets:{crew:Boolean(teamCharacter),rover:reference.children.length>0},
    fps: fps.active, player: fps.telemetry, environment: environment.telemetry,
    lifeSupport: lifeSupport.telemetry, // IHAN-SRC: deterministic observer contract
    crewAgents: crewAgents.telemetry,rover:roverAgent.telemetry,comms:comms.telemetry,
    placement: { selected: selected ?? null, preview: preview.visible, marker: marker.visible },
    rendering: { ...frameStats, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio() },
  })
  window.advanceTime = async ms => {
    if (!Number.isFinite(ms) || ms < 0) throw new RangeError("Invalid time step")
    manualTime = true
    let remaining = ms / 1000
    // Only the final view needs picking during deterministic fast-forward.
    // Movement/ground contact still use every fixed suit step.
    while (remaining > 1e-9) { const dt = Math.min(1/60, remaining); tick(dt, false); remaining -= dt }
    if (fps.active) fps.update(0)
    while (!gpuReady()) await new Promise(requestAnimationFrame)
    renderFrame()
    while (!gpuReady()) await new Promise(requestAnimationFrame)
  }

  function redrawScene() {
    if (disposed) return
    const playerIndex = state.crew.findIndex(person => person.id === playerId)
    byId("helmet").textContent = "Astronot " + (playerIndex + 1) + " · Sağlık %" + state.crew[playerIndex].health
    // IHAN-SRC: sol completion uses the new colony power/weather row.
    lifeSupport.sync(state)
    environment.setLifeSupport({...lifeSupport.telemetry,lab:ova.soilAnalysis})
    environment.sync(state, status.textContent)
    objects.clear()
    for (const node of surfaceDeposits) depositMeshes.get(node.id).visible = workshop.collected[node.id] !== state.sol
    roofs.clear()
    groundObstacles.length = 0
    for (const asset of hardware.filter(asset => asset !== crewLander && asset !== reference && asset.visible)) groundObstacles.push({ x: asset.position.x, z: asset.position.z,
      halfX: asset.userData.radius, halfZ: asset.userData.radius })
    const moduleLights = []
    for (const item of state.placed) {
      const { x, z, supportId } = worldPlacement(item)
      const unit = model(item.type)
      const size = footprints[item.type]
      const roof = supportId && roofs.get(supportId)
      const y = roof ? roof.userData.top : foundationHeight(x, z, size)
      unit.position.set(x, y, z)
      moduleLights.push({ x, y, z, halfZ: size.z, lightHeight: item.type.endsWith("Pod") ? .85 : 1.35,
        type: item.type, active: item.active })
      unit.userData.module = item
      if (!supportId) {
        for (const side of [-1, 1]) for (const back of [-1, 1]) {
          const dx = side * size.x * .74
          const dz = back * size.z * .74
          const terrainY = groundY(x + dx, z + dz)
          const length = Math.max(.06, y - terrainY)
          const foot = new T.Mesh(foundationGeometry, roofMaterial)
          foot.scale.set(.18, length, .18)
          foot.position.set(dx, -length / 2 + .01, dz)
          foot.castShadow = true
          unit.add(foot)
        }
      }
      unit.traverse(part => {
        if (part.isMesh) {
          part.castShadow = !part.userData.noShadow
          part.receiveShadow = !part.userData.noShadow
        }
      })
      const plants = unit.getObjectByName("plants")
      if (plants) {
        plants.visible = item.type === "treePod" || workshop.growing[item.id] !== null
        plants.scale.setScalar(.38 + .62 * (workshop.growing[item.id] ?? 0) / crops[item.type].sols)
      }
      objects.add(unit)
      if (!supportId) groundObstacles.push({ x, z, halfX: size.x, halfZ: size.z })
      if (item.type === "habitat") {
        const mount = new T.Mesh(roofGeometry, roofMaterial)
        mount.position.y = roofHeight + .075
        mount.castShadow = mount.receiveShadow = true
        mount.userData = { roofId: item.id, top: y + roofHeight + .15 }
        unit.add(mount)
        roofs.set(item.id, mount)
        for (const side of [-1, 1]) {
          const edgeX = new T.Mesh(railShort, roofMark)
          edgeX.position.set(side * (roofSize.x - .04), roofHeight + .151, 0)
          const edgeZ = new T.Mesh(railLong, roofMark)
          edgeZ.position.set(0, roofHeight + .151, side * (roofSize.z - .04))
          // Edge markings are visual only. Raycasting must reach the mount.
          edgeX.raycast = edgeZ.raycast = () => {}
          unit.add(edgeX, edgeZ)
          for (const back of [-1, 1]) {
            const post = new T.Mesh(postGeometry, roofMaterial)
            post.scale.y = roofHeight
            post.position.set(side * 1.35, roofHeight / 2, back * 1.35)
            post.castShadow = true
            unit.add(post)
          }
        }
      }
    }
    state.crew.forEach((person, index) => {
      crewModels.get(index).visible = person.health > 0 && (!fps.active || person.id !== playerId)
    })
    ova.solar.updatePowerDisplay(lifeSupport.power.telemetry.live?.groups??[]);
    environment.syncModules(moduleLights)
    scene.updateMatrixWorld(true)
    preview.clear()
    drawTarget(fps.active ? targetAt() : lastPointer ? targetAt(lastPointer) : null)
    if (manualTime) renderFrame()
  }

  function foundationHeight(x, z, size) {
    return Math.max(groundY(x, z), ...[-1, 1].flatMap(a =>
      [-1, 1].map(b => groundY(x + a * size.x, z + b * size.z)))) + .006
  }

  async function parseSceneModel(bytes) {
    const gltf = await parseModel(bytes)
    if (disposed) {
      disposeModel(gltf.scene)
      throw new DOMException("Scene disposed", "AbortError")
    }
    return gltf
  }

  async function loadNASA() {
    const targets = [
      ["team-crew-data", gltf => {
        teamCharacter = fitCharacter(gltf.scene)
        for (const [index, actor] of crewModels) {
          if (loadedCharacters.has(index)) continue
          retiredCharacters.push(...actor.children)
          actor.clear()
          actor.add(teamCharacter.clone(true))
        }
        byId("character-status").textContent = "Uçuş modelindeki NASA astronotu kullanılıyor."
      }],
    ]
    const results = await Promise.allSettled(targets.map(async ([id, apply]) =>
      apply(await parseSceneModel(await loadBytes(id, lifecycle.signal)))))
    if (disposed) return
    redrawScene()
    byId("nasa-status").textContent = results.every(item => item.status === "fulfilled")
      ? "Düz Ova · NASA astronotları ve Perseverance"
      : "Bazı NASA modelleri açılamadı. İlgili parça için geçici model kullanılıyor."
  }

  return {
    redraw: redrawScene,
    resetEnvironment() { environment.reset(); lifeSupport.reset(state);roverAgent.reset() }, // IHAN-SRC
    loadNASA,
    dispose() {
      if (disposed) return
      disposed = true; lifecycle.abort(); taskObserver.disconnect()
      renderer.setAnimationLoop(null)
      if (gpuFence) gl.deleteSync(gpuFence)
      observer.disconnect();roverAgent.dispose();crewAgents.dispose(); lifeSupport.dispose(); fps.dispose(); ova.dispose(); // IHAN-SRC
       environment.dispose(); tracks.dispose(); controls.dispose()
      window.render_game_to_text = previousTextHook; window.advanceTime = previousAdvanceHook
      const geometries = new Set(), materials = new Set(), textures = new Set()
      scene.traverse(part => {
        if (part.geometry) geometries.add(part.geometry)
        for (const material of [part.material].flat()) if (material) {
          materials.add(material)
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
        }
      })
      for (const source of [...models.values(), teamCharacter, ...retiredCharacters]) source?.traverse(part => {
        if (part.geometry) geometries.add(part.geometry)
        for (const material of [part.material].flat()) if (material) {
          materials.add(material)
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
        }
      })
      for (const geometry of [roofGeometry, railLong, railShort, postGeometry, foundationGeometry]) geometries.add(geometry)
      for (const material of [roofMaterial, roofMark, ghostMaterial, oreMaterial, iceMaterial]) materials.add(material)
      for (const resource of [...geometries, ...materials, ...textures]) resource.dispose()
      renderer.dispose()
    },
    setView(name) {
      const view = ova.views[name]
      if (!view) return
      if (fps.active) fps.setActive(false)
      navigation.reset(); roofAccess=undefined; currentView=name
      camera.position.fromArray(view.position); controls.target.fromArray(view.target); controls.update()
      for (const button of document.querySelectorAll('[data-ova-view]')) button.setAttribute('aria-pressed',String(button.dataset.ovaView===name))
      status.textContent=name==='solar' ? 'Güneş tarlası · 42 masa · 420 panel' : name==='pad' ? 'Modül kurulum alanı · Zemine tıklayarak yerleştir.' : 'Düz Ova · İhan’ın Mars üssü'
    },
    toggleView() {
      // Only the very first FPS entry starts at the lander ladder. Later entries resume where the
      // astronaut left off (setActive(false) stores the last position/heading as the spawn).
      if (!fps.active && !fpsEntered) fps.respawn(crewActor(playerId).position, arrivalYaw)
      fps.setActive(!fps.active)
    },
    selectPlayer() {
      roofAccess = undefined
      navigation.reset()
      fps.respawn(crewActor(playerId).position, arrivalYaw)
      redrawScene()
    },
    async loadCharacter(id, bytes) {
      const index = state.crew.findIndex(person => person.id === id)
      const actor = crewModels.get(index)
      if (!actor) throw new RangeError("Astronot bulunamadı.")
      const gltf = await parseSceneModel(bytes)
      const character = fitCharacter(gltf.scene)
      // Shared default GLB resources remain alive until scene teardown.
      // Retire custom models too, so all geometries/textures have one disposal owner.
      retiredCharacters.push(...actor.children)
      actor.clear()
      actor.add(character)
      loadedCharacters.add(index)
    },
    async loadRover() {
      const button = byId("rover")
      const feedback = byId("rover-status")
      if (reference.children.length) {
        reference.visible = !reference.visible
        button.textContent = reference.visible ? "Perseverance’ı gizle" : "Perseverance’ı göster"
        feedback.textContent = reference.visible ? "Perseverance, üssün batısında · NASA/JPL" : ""
        redrawScene()
        return
      }
      button.disabled = true
      feedback.textContent = "NASA modeli yükleniyor…"
      try {
        const gltf = await parseSceneModel(await loadBytes("rover-data", lifecycle.signal))
        const rover = new T.Group()
        rover.add(fitCharacter(prepareOvaRover(gltf.scene), 2.18))
        reference.position.y = groundY(reference.position.x, reference.position.z)
        reference.add(rover)
        roverAgent.bindModel(rover)
        reference.userData.radius = 1.55
        hardware.push(reference)
        redrawScene()
        feedback.textContent = "Perseverance, üssün batısında · NASA/JPL"
        button.textContent = "Perseverance’ı gizle"
      } catch (error) {
        if (disposed) return
        console.error(error)
        button.disabled = false
        feedback.textContent = "Model yüklenemedi. Tekrar dene."
      } finally {
        button.disabled = false
      }
    },
  }
}

// Integration (Emre): models are served from public/models/colony instead of base64 blocks
// embedded in the single-file build; Draco decoder comes from public/draco.
const modelFiles = {
  "rover-data": "perseverance-wheels.glb",
  "team-crew-data": "team-astronaut-walk.glb",
}
async function loadBytes(id, signal) {
  const response = await fetch(import.meta.env.BASE_URL + "models/colony/" + modelFiles[id], { signal })
  if (!response.ok) throw new Error("Model indirilemedi: " + modelFiles[id])
  return response.arrayBuffer()
}

async function parseModel(bytes) {
  const decoder = new DRACOLoader().setDecoderPath(import.meta.env.BASE_URL + "draco/")
  try {
    return await new GLTFLoader().setDRACOLoader(decoder).parseAsync(bytes, "")
  } finally {
    decoder.dispose()
  }
}

function fitCharacter(character, height = 1.85) {
  const bounds = new T.Box3().setFromObject(character)
  const size = bounds.getSize(new T.Vector3())
  const center = bounds.getCenter(new T.Vector3())
  if (!(size.y > 0)) throw new Error("Karakter geometrisi bulunamadı.")
  const scale = height / size.y // GAME ASSUMPTION: display height in metres, recovered from the Düz Ova demo.
  character.scale.multiplyScalar(scale)
  character.position.multiplyScalar(scale)
  character.position.add(new T.Vector3(-center.x * scale, -bounds.min.y * scale, -center.z * scale))
  character.traverse(part => { if (part.isMesh) part.castShadow = true })
  return character
}

// For asynchronous assets that finish decoding after scene teardown.
function disposeModel(root) {
  const resources = new Set()
  root.traverse(part => {
    if (part.geometry) resources.add(part.geometry)
    for (const material of [part.material].flat()) if (material) {
      resources.add(material)
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value)
    }
  })
  for (const resource of resources) resource.dispose()
}

function button(text, onClick) {
  const item = document.createElement("button")
  item.type = "button"
  item.textContent = text
  item.onclick = onClick
  return item
}
function workshopAction(action) {
  if (lastReport.status !== "in-progress") return
  const feedback = byId("workshop-message")
  try {
    feedback.textContent = action()
    status.textContent = feedback.textContent
    update()
  } catch (error) {
    feedback.textContent = error.message
    status.textContent = error.message
  }
}

function tendCrop(unit) {
  workshopAction(() => {
    if (workshop.growing[unit.id] === null) {
      workshop = replant(workshop, unit)
      return modules[unit.type].name + " · Yeni üretim dönemi başladı."
    }
    workshop = harvest(workshop, unit)
    const crop = crops[unit.type]
    return "+" + crop.amount + " " + materialNames[crop.yield] + " · +" + crop.xp + " tarım XP"
  })
}

function updateWorkshop(stopped) {
  const { stock, xp } = workshop
  byId("workshop-stock").textContent = stock.credits + " kredi · " + Object.entries(stock)
    .filter(([id]) => id !== "credits")
    .map(([id, amount]) => materialNames[id] + " " + amount).join(" · ")
  byId("workshop-skills").textContent = "Tarım " + levelOf(xp.farming) + ". seviye · " + xp.farming + " XP"
  byId("recipes").replaceChildren(...recipes.map(recipe => {
    const action = button(recipe.name, () => workshopAction(() => {
      workshop = craft(workshop, recipe.id)
      if (!recipe.reward) {
        const item = { id: "workshop-" + workshop.crafted, type: recipe.id }
        state = { ...state, inventory: [...state.inventory, item] }
        selected = item.id
      }
      return recipe.name + " · Tamamlandı."
    }))
    const detail = document.createElement("small")
    const cost = Object.entries(recipe.cost).map(([id, amount]) => amount + " " + materialNames[id]).join(" · ")
    detail.textContent = recipeError(workshop, recipe) || cost
    action.title = cost
    action.append(detail)
    action.disabled = stopped
    return action
  }))
  byId("harvests").replaceChildren(...state.placed.filter(unit => crops[unit.type]).map(unit => {
    const crop = crops[unit.type]
    const empty = workshop.growing[unit.id] === null
    const progress = workshop.growing[unit.id] ?? 0
    const action = button(modules[unit.type].name + " · " +
      (empty ? "Yeni dönem başlat" : progress === crop.sols ? "Hasat et" : progress + "/" + crop.sols + " sol"),
      () => tendCrop(unit))
    action.disabled = stopped || (!empty && progress < crop.sols)
    return action
  }))
  const saleButtons = [["mineral", 2], ["potato", 4], ["bean", 6], ["apple", 8]].map(([id, price]) => {
    const action = button(materialNames[id] + " teslim et · +" + price + " kredi", () => workshopAction(() => {
      workshop = sell(workshop, id)
      return materialNames[id] + " teslim edildi · +" + price + " kredi"
    }))
    action.disabled = stopped || stock[id] < 1
    return action
  })
  const foodButtons = ["potato", "bean", "apple"].filter(id => stock[id] > 0).map(id => {
    const action = button(materialNames[id] + " → erzak", () => workshopAction(() => {
      workshop = { ...workshop, stock: { ...workshop.stock, [id]: workshop.stock[id] - 1 } }
      state = { ...state, supplies: { ...state.supplies, food: state.supplies.food + 1 } }
      return materialNames[id] + " erzağa eklendi."
    }))
    action.disabled = stopped
    return action
  })
  byId("trade").replaceChildren(...saleButtons, ...foodButtons)
}

function update() {
  lastReport = colonyReport(state)
  const stopped = lastReport.status !== "in-progress"
  byId("sol").textContent = state.sol + " / " + missionLength + " sol"
  byId("advance").disabled = stopped
  const day = state.timeline.at(-1)
  const choices = byId("player")
  for (const option of choices.options) {
    option.disabled = state.crew.find(person => person.id === option.value).health <= 0
  }
  const livingPlayer = state.crew.find(person => person.health > 0)
  if (livingPlayer && state.crew.find(person => person.id === playerId).health <= 0) {
    playerId = livingPlayer.id
    choices.value = playerId
    sceneView?.selectPlayer()
  }
  byId("weather").textContent = day?.storm ? "Toz fırtınası" : day ? "Açık gökyüzü" : "İniş tamamlandı"
  byId("inventory").replaceChildren(...state.inventory.map(item => {
    const choice = button(modules[item.type].name, () => { selected = selected === item.id ? undefined : item.id; update() })
    choice.setAttribute("aria-pressed", String(selected === item.id))
    choice.title = modules[item.type].detail
    choice.disabled = stopped
    return choice
  }))
  byId("selected").textContent = selected ? modules[state.inventory.find(item => item.id === selected).type].detail
    : state.inventory.length ? "Yerleştirmek için bir modül seç. Seçimi kaldırmak için tekrar tıkla." : "Envanter boş."
  byId("crew").replaceChildren(...state.crew.map((person, index) => {
    const label = document.createElement("label")
    label.append("Astronot " + (index + 1) + " · %" + person.health)
    const select = document.createElement("select")
    select.add(new Option("Görev seç", ""))
    for (const [id, name] of Object.entries(roles)) select.add(new Option(name, id))
    select.value = person.role ?? ""
    select.disabled = stopped || !person.health
    select.onchange = () => { state = assignAstronaut(state, person.id, select.value || null) }
    label.append(select)
    return label
  }))
  const number = new Intl.NumberFormat("tr", { maximumFractionDigits: 2 })
  byId("resources").textContent = "Su " + number.format(state.supplies.water) + " · Oksijen " + number.format(state.supplies.oxygen) +
    " · Yiyecek " + number.format(state.supplies.food) + " · Yedek parça " + state.supplies.spareParts
  byId("energy").textContent = day ? "Üretilen " + day.generation + " · Harcanan " + day.used + " · Batarya " + day.battery + "/" + day.capacity
    : "Başlangıç enerjisi " + state.startupEnergy
  byId("system-status").textContent = state.operations
    ? (day?.systems.join(" · ") || "Yaşam desteği donanımını yerleştir ve inşaata ata.") : ""
  byId("buildings").textContent = state.placed.filter(item => item.active).length + " etkin · " +
    state.placed.filter(item => !item.active).length + " inşaat bekliyor"
  const tbody = byId("log")
  tbody.replaceChildren()
  for (const row of state.timeline) {
    const tr = tbody.insertRow()
    for (const value of [row.sol, row.storm ? "Fırtına" : "Açık", row.generation,
      row.used, row.battery, row.missing.map(key => labels[key]).join(", ") || "Karşılandı"]) {
      tr.insertCell().textContent = value
    }
  }
  byId("outcome").textContent = stopped ? (lastReport.status === "success" ? "Görev başarılı" : "Görev başarısız") : "Görev sürüyor"
  byId("reasons").replaceChildren(...lastReport.reasons.map(reason => {
    const item = document.createElement("li")
    item.textContent = reason
    return item
  }))
  byId("report").disabled = !stopped
  updateWorkshop(stopped)
  sceneView?.redraw()
}

byId("advance").onclick = () => {
  const next = advanceSol(state, { prioritizeLifeSupport: byId("priority").checked })
  if (next !== state) workshop = grow(workshop, next)
  state = next
  update()
  const day = state.timeline.at(-1)
  if (day) {
    status.textContent = lastReport.status !== "in-progress" ? "Görev bitti. Sonucu görev raporunda incele."
      : day.missing.length ? "Karşılanmayan ihtiyaçlar · " + day.missing.map(key => labels[key]).join(", ")
      : "Sol " + day.sol + " tamamlandı. Sıradaki sol için görevleri ata."
  }
}
function beginColony(next) {
  state = next
  sceneView?.resetEnvironment()
  workshop = startWorkshop()
  byId("workshop-message").textContent = "Seradaki kabinleri yetiştir; hasadı erzağa aktar."
  selected = undefined
  playerId = (state.crew.find(person => person.health > 0) ?? state.crew[0]).id
  byId("player").replaceChildren(...state.crew.map((person, index) => new Option("Astronot " + (index + 1), person.id)))
  byId("player").value = playerId
  status.textContent = "Envanterden modül seç ve uygun yüzeye yerleştir."
  update()
  sceneView?.selectPlayer()
}
function startPlannedColony(plan) {
  return createSceneColony(landing, plan)
}
byId("reset").onclick = () => beginColony(startColony())

const cargoForm = byId("cargo-form")
function configureCargo() {
  for (const [key, value] of Object.entries(defaultManifest)) {
    if (key !== "equipment") cargoForm.elements.namedItem(key).value = value
  }
  for (const [id, item] of Object.entries(cargoOptions)) {
    const label = document.createElement("label")
    label.className = "check"
    label.title = item.description
    const input = document.createElement("input")
    input.type = "checkbox"
    input.name = "equipment"
    input.value = id
    input.checked = defaultManifest.equipment.includes(id)
    label.append(input, item.name)
    byId("cargo-kit").append(label)
  }
}
function currentPlan() {
  if (!cargoForm.checkValidity()) return null
  const inputs = new FormData(cargoForm)
  try {
    return planMission({
      mealDays: Number(inputs.get("mealDays")), waterDays: Number(inputs.get("waterDays")),
      oxygenDays: Number(inputs.get("oxygenDays")), spareParts: Number(inputs.get("spareParts")),
      driedMealShare: Number(inputs.get("driedMealShare")), equipment: inputs.getAll("equipment"),
    })
  } catch { return null }
}
function showPlan() {
  const plan = currentPlan()
  byId("cargo-launch").disabled = landing.source === "flight" || !plan?.withinLimit
  if (!plan) {
    byId("cargo-total").textContent = "Erzak miktarlarını izin verilen aralıkta gir."
    byId("transit-plan").textContent = ""
    byId("cargo-list").replaceChildren()
    return
  }
  const kg = value => Math.round(value).toLocaleString("tr-TR") + " kg"
  byId("cargo-total").textContent = "Mars iniş yükü " + kg(plan.massKg) + " / " + kg(cargoLimitKg) +
    (plan.withinLimit ? "" : " · Kütle sınırı aşıldı")
  const { transit } = plan
  byId("transit-plan").textContent = transitDays + " Dünya günü transfer için " +
    kg(transit.foodKg) + " öğün, " + kg(transit.waterKg) + " su ve " +
    kg(transit.oxygenReserveKg) + " yedek oksijen. Transfer aracında su geri kazanımı ve elektroliz varsayılıyor."
  byId("cargo-list").replaceChildren(...plan.cargo.map(entry => {
    const item = document.createElement("li")
    item.textContent = entry.name + " · " + kg(entry.kg)
    return item
  }))
}
configureCargo()
showPlan()
cargoForm.addEventListener("input", showPlan, { signal: uiLifecycle.signal })
cargoForm.addEventListener("submit", event => {
  event.preventDefault()
  const plan = currentPlan()
  if (landing.source === "flight" || !plan?.withinLimit) return
  activeMissionPlan = plan
  beginColony(startPlannedColony(plan))
  updateLandingSource("Dünya yük planı uygulandı")
}, { signal: uiLifecycle.signal })
byId("landing-file").onchange = async event => {
  const input = event.currentTarget
  const file = input.files[0]
  if (!file) return
  input.disabled = true
  try {
    const payload = JSON.parse(await file.text())
    const next = createColonyFromFlight(payload)
    landing = { ...payload, source: "flight" }
    activeMissionPlan = undefined
    beginColony(next)
    showPlan()
    updateLandingSource("JSON uçuş verisi alındı")
    byId("landing-status").textContent = "Uçuş verisi alındı · " + file.name + " · İniş tercihi " +
      (payload.landingSite === "flat" ? "düz saha" : "engebeli saha") + " · Başlangıç enerjisi " + payload.surfaceEnergy
  } catch {
    byId("landing-status").textContent = "İniş verisi okunamadı. Emre’nin crew, supplies, modules, landingSite ve surfaceEnergy alanlarını içeren JSON dosyasını seç."
  } finally {
    input.disabled = false
    input.value = ""
  }
}
byId("report").onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = "mars-koloni-raporu.json"
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
try {
  sceneView = makeScene()
  const choices = byId("player")
  state.crew.forEach((person, index) => choices.add(new Option("Astronot " + (index + 1), person.id)))
  choices.onchange = () => { playerId = choices.value; sceneView.selectPlayer() }
  byId("view-mode").onclick = () => sceneView.toggleView()
  const characterFile = byId("character-file")
  characterFile.onchange = async () => {
    const file = characterFile.files[0]
    if (!file) return
    const id = playerId
    const name = choices.selectedOptions[0].textContent
    const feedback = byId("character-status")
    characterFile.disabled = true
    feedback.textContent = "Karakter yükleniyor…"
    try {
      const bytes = await file.arrayBuffer()
      if (bytes.byteLength < 12 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) {
        throw new Error("Geçersiz GLB")
      }
      await sceneView.loadCharacter(id, bytes)
      feedback.textContent = name + " · " + file.name + " yüklendi."
    } catch {
      feedback.textContent = "Model açılamadı. Dokuları dosyaya gömülü bir GLB seç."
    } finally {
      characterFile.value = ""
      characterFile.disabled = false
    }
  }
  byId("rover").onclick = () => sceneView.loadRover()
  for (const button of document.querySelectorAll('[data-ova-view]')) button.addEventListener('click',()=>sceneView.setView(button.dataset.ovaView),{signal:uiLifecycle.signal})
  sceneView.setView('panorama')
  sceneView.loadNASA()
  sceneView.loadRover()
  if (document.querySelector("main").dataset.startView === "fps") sceneView.toggleView()
} catch (error) {
  console.error(error)
  viewport.hidden = true
  byId("rover").disabled = true
  byId("view-mode").disabled = true
  byId("character-file").disabled = true
  status.textContent = "3B görünüm açılamadı. WebGL destekleyen bir tarayıcıda aç."
}
updateLandingSource(landing.source === "flight" ? "Uçuştan gelen iniş verisi" : "Varsayılan Dünya yükü")
update()

function updateLandingSource(label) {
  byId("landing-source").textContent = label + " · Jezero Krateri"
  byId("landing-source").title = "İniş stoku · Su " + state.supplies.water + " · Oksijen " + state.supplies.oxygen +
    " · Yiyecek " + state.supplies.food + " kişi-sol · Yedek parça " + state.supplies.spareParts
  byId("landing-status").textContent = label + (landing.source === "flight"
    ? " · Uçuş erzakları korunuyor; Dünya yük planı yalnızca önizlemedir."
    : " · Yük planını değiştirip yeni Mars operasyonunu başlatabilirsin.")
}

// Preserve a back-forward cached page; release listeners/resources on real teardown/HMR.
function disposePage() {
  uiLifecycle.abort()
  sceneView?.dispose()
  for (const id of ["advance", "reset", "report", "view-mode", "rover", "character-file", "landing-file", "player"]) {
    byId(id).onclick = byId(id).onchange = null
  }
}
window.addEventListener("pagehide", event => { if (!event.persisted) disposePage() }, { signal: uiLifecycle.signal })
if (import.meta.hot) import.meta.hot.dispose(disposePage)
