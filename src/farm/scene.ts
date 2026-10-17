import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { CROPS } from './data'
import { plotInfo } from './engine'
import type { FarmState } from './engine'
import { CONFIG, DEFAULT_CONFIG } from '../game/config'
import { icon, time } from './icons'

const files = import.meta.glob('../../assets/farm/**/*.fbx', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const file = (name: string) => Object.entries(files).find(([path]) => path.endsWith(name))?.[1]
const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true })
const soil = new THREE.BoxGeometry(1.65, .19, 1.65)
const rim = new THREE.BoxGeometry(1.79, .13, 1.79)
const soilDry = mat('#92704a'), soilWet = mat('#795a3c'), rimMaterial = mat('#bda377')
const sphere = new THREE.IcosahedronGeometry(1, 1)

export class FarmScene {
  visible = true
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-12, 12, 12, -12, .1, 150)
  private state: FarmState
  private staticWorld = new THREE.Group()
  private field = new THREE.Group()
  private cropRoots = new THREE.Group()
  private models = new Map<string, THREE.Object3D>()
  private cropModels = new Map<string, THREE.Object3D>()
  private hits: THREE.Object3D[] = []
  private raycaster = new THREE.Raycaster()
  private selection = new THREE.Mesh(new THREE.BoxGeometry(1.82, .06, 1.82), new THREE.MeshBasicMaterial({ color: '#e7bc5d', transparent: true, opacity: .6 }))
  private selected = -1
  private elapsed = 0
  private zoomAmount = 1
  private signature = ''
  private labels: Array<{ el: HTMLElement; index: number; pos: THREE.Vector3 }> = []
  private status: HTMLElement
  private onSelect: (index: number) => void
  private canvas: HTMLCanvasElement
  private loaded = false
  private width = 0
  private height = 0

  constructor(canvas: HTMLCanvasElement, state: FarmState, onSelect: (index: number) => void) {
    this.canvas = canvas; this.state = state; this.onSelect = onSelect
    this.status = document.querySelector('#scene-loader')!
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor('#e3e9d0')
    this.scene.fog = new THREE.Fog('#e3e9d0', 40, 70)
    this.camera.position.set(20, 23, 23)
    this.camera.lookAt(0, 0, 0)
    this.scene.add(new THREE.HemisphereLight('#fffbdc', '#8ea372', 2.5))
    const sun = new THREE.DirectionalLight('#fff5ce', 3.2); sun.position.set(-12, 22, 12); sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -22; sun.shadow.camera.right = 22; sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22; sun.shadow.normalBias = .07
    this.scene.add(sun, this.staticWorld, this.field, this.cropRoots, this.selection)
    this.selection.visible = false
    this.ground()
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!)
    this.resize()
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !this.loaded) return
      const rect = canvas.getBoundingClientRect()
      this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera)
      const hit = this.raycaster.intersectObjects(this.hits)[0]
      if (hit) { const index = hit.object.userData.index as number; this.selected = index; this.selection.visible = true; this.selection.position.copy(hit.object.position).add(new THREE.Vector3(0, .03, 0)); this.onSelect(index) }
    })
    canvas.addEventListener('keydown', e => {
      let index = this.selected < 0 ? 0 : this.selected
      if (e.key === 'ArrowRight') index = Math.min(this.state.plots.length - 1, index + 1)
      else if (e.key === 'ArrowLeft') index = Math.max(0, index - 1)
      else if (e.key === 'ArrowDown') index = Math.min(this.state.plots.length - 1, index + 4)
      else if (e.key === 'ArrowUp') index = Math.max(0, index - 4)
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onSelect(index); return }
      else return
      e.preventDefault(); this.selected = index; this.selection.visible = true; this.selection.position.copy(this.position(index)).add(new THREE.Vector3(0, .28, 0))
    })
  }
  setState(state: FarmState) { this.state = state; this.signature = ''; this.sync() }
  private ground() {
    const land = new THREE.Mesh(new THREE.BoxGeometry(26, .75, 24), mat('#b6c58c')); land.position.y = -.65; land.receiveShadow = true; this.staticWorld.add(land)
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(25.8, 23.8), mat('#bbc992')); grass.rotation.x = -Math.PI / 2; grass.position.y = -.26; grass.receiveShadow = true; this.staticWorld.add(grass)
    const path = new THREE.Mesh(new THREE.PlaneGeometry(25.8, 2.2), mat('#d4c99f')); path.rotation.x = -Math.PI / 2; path.position.set(0, -.24, 5.3); path.receiveShadow = true; this.staticWorld.add(path)
    const backPath = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 15), mat('#d4c99f')); backPath.rotation.x = -Math.PI / 2; backPath.position.set(-5.8, -.23, -1); backPath.receiveShadow = true; this.staticWorld.add(backPath)
    const pond = new THREE.Mesh(new THREE.CircleGeometry(3.4, 12), new THREE.MeshStandardMaterial({ color: '#86bbc0', roughness: .35, transparent: true, opacity: .9 })); pond.rotation.x = -Math.PI / 2; pond.scale.set(1, .7, 1); pond.position.set(8.5, -.23, 7.3); this.staticWorld.add(pond)
    const sand = new THREE.Mesh(new THREE.CircleGeometry(3.8, 12), mat('#c7cfaa')); sand.rotation.x = -Math.PI / 2; sand.scale.set(1, .72, 1); sand.position.set(8.5, -.24, 7.3); this.staticWorld.add(sand)
    for (let i = 0; i < 11; i++) { const stone = new THREE.Mesh(sphere, mat(i % 2 ? '#ece6c6' : '#d8dfb7')); stone.scale.set(.32, .08, .18); stone.position.set(-9.8 + i * .95, -.18, 5.1 + Math.sin(i) * .1); this.staticWorld.add(stone) }
  }
  async load() {
    const loader = new FBXLoader()
    const names = ['FBX__Barn.fbx', 'FBX__SmallBarn.fbx', 'FBX__Silo.fbx', 'FBX__Fence.fbx', 'FBX__Well.fbx', 'FBX__Windmill.fbx', 'FBX__Bush1.fbx', 'FBX__Grass1.fbx', 'FBX__Tree1.fbx', 'FBX__Tree2.fbx', 'FBX__Rock1.fbx']
    let progress = 0
    const loadAll = async () => {
      await Promise.all(names.map(async name => {
        const url = file(name)
        if (!url) throw new Error(`Missing farm asset: ${name}`)
        const model = await loader.loadAsync(url)
        model.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true } })
        this.models.set(name, model)
        progress++
        this.status.querySelector('span')!.textContent = `تجهيز المزرعة ${progress} / ${names.length}`
      }))
      this.populate()
      this.loaded = true
      this.sync()
      this.status.hidden = true
      this.render(0)
    }
    try { await loadAll() } catch (err) {
      this.status.className = 'failed'
      this.status.innerHTML = '<span>تعذر تحميل مباني المزرعة. تقدمك لم يُحذف.</span><button class="btn" id="retry-scene">إعادة المحاولة</button>'
      console.error(err)
      document.querySelector('#retry-scene')!.addEventListener('click', () => location.reload())
      throw err
    }
  }
  private normalized(name: string, size: number): THREE.Object3D {
    const source = this.models.get(name)!
    const model = source.clone(true)
    const box = new THREE.Box3().setFromObject(model)
    const scale = size / Math.max(...box.getSize(new THREE.Vector3()).toArray())
    model.scale.multiplyScalar(scale)
    const bounds = new THREE.Box3().setFromObject(model)
    const center = bounds.getCenter(new THREE.Vector3())
    model.position.set(-center.x, -bounds.min.y, -center.z)
    const root = new THREE.Group(); root.add(model); return root
  }
  private addModel(name: string, size: number, x: number, z: number, rotation = 0) {
    const root = this.normalized(name, size); root.position.set(x, -.23, z); root.rotation.y = rotation; this.staticWorld.add(root); return root
  }
  private populate() {
    this.addModel('FBX__Barn.fbx', 5, -6.7, -5.4, .15)
    this.addModel('FBX__SmallBarn.fbx', 3.2, 5.8, -5.4, .15)
    this.addModel('FBX__Silo.fbx', 3.5, 8, -5.8)
    this.addModel('FBX__Well.fbx', 2, -7.6, 1.3)
    this.addModel('FBX__Windmill.fbx', 3.5, -10, -4.1)
    for (let i = 0; i < 13; i++) {
      this.addModel('FBX__Fence.fbx', 1.8, -11.2 + i * 1.82, 9.6)
      this.addModel('FBX__Fence.fbx', 1.8, -11.2 + i * 1.82, -9.4)
    }
    for (let i = 0; i < 10; i++) { this.addModel('FBX__Fence.fbx', 1.8, -11.6, -8 + i * 1.8, Math.PI / 2); this.addModel('FBX__Fence.fbx', 1.8, 11.6, -8 + i * 1.8, Math.PI / 2) }
    const trees = [[-9, -8], [-5, -9], [10, -8], [10, 1.5], [-10, 3], [-8, 8], [3, 8.5], [9, 10.5], [-12, -1]]
    trees.forEach(([x, z], i) => this.addModel(i % 2 ? 'FBX__Tree1.fbx' : 'FBX__Tree2.fbx', 3.8 + (i % 3) * .3, x, z, i))
    for (let i = 0; i < 24; i++) {
      const x = Math.sin(i * 51.7) * 10, z = Math.cos(i * 23.1) * 8
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue
      this.addModel('FBX__Grass1.fbx', .45 + (i % 3) * .1, x, z, i * 2)
    }
    for (let i = 0; i < 6; i++) this.addModel('FBX__Rock1.fbx', .5 + (i % 3) * .25, 5.3 + i * .7, 8 + Math.cos(i) * 2, i)
    for (const [id, c] of Object.entries(CROPS)) {
      const plant = this.normalized(id === 'garlic' || id === 'onion' || id === 'corn' ? 'FBX__Grass1.fbx' : 'FBX__Bush1.fbx', .6)
      plant.traverse(o => {
        if (o instanceof THREE.Mesh) { const material = Array.isArray(o.material) ? o.material : [o.material]; o.material = material.map(m => { const cloned = m.clone(); if ('color' in cloned) (cloned as THREE.MeshStandardMaterial).color.set(id === 'garlic' ? '#95a762' : id === 'tomato' ? '#58873f' : id === 'carrot' ? '#89a14b' : c.color); return cloned }) }
      })
      this.cropModels.set(id, plant)
    }
  }
  position(index: number) { const rows = Math.ceil(this.state.plots.length / 4); return new THREE.Vector3((index % 4 - 1.5) * 1.98, -.08, (Math.floor(index / 4) - (rows - 1) / 2) * 1.98) }
  sync() {
    if (!this.loaded) return
    const signature = JSON.stringify(this.state.plots.map((p, i) => p ? [p.crop, plotInfo(this.state, i).ready, plotInfo(this.state, i).needsWater, Math.floor(plotInfo(this.state, i).progress * 4)] : null))
    if (signature === this.signature) return
    this.signature = signature
    this.field.clear(); this.cropRoots.clear(); this.hits = []
    document.querySelector('#plot-labels')!.innerHTML = ''
    this.labels = []
    this.state.plots.forEach((plot, i) => {
      const pos = this.position(i)
      const border = new THREE.Mesh(rim, rimMaterial); border.position.copy(pos); border.receiveShadow = true; this.field.add(border)
      const tile = new THREE.Mesh(soil, plot?.watered ? soilWet : soilDry); tile.position.copy(pos).add(new THREE.Vector3(0, .07, 0)); tile.receiveShadow = true; tile.userData.index = i; this.field.add(tile); this.hits.push(tile)
      // Ground ridges are part of the field topology, not replacement model artwork.
      for (let row = 0; row < 4; row++) { const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.4, .04, .05), plot?.watered ? soilDry : rimMaterial); ridge.position.copy(pos).add(new THREE.Vector3(0, .19, -.6 + row * .4)); this.field.add(ridge) }
      if (plot) {
        const info = plotInfo(this.state, i)
        const stage = Math.max(.22, Math.min(1, info.progress + .18))
        const plants = new THREE.Group()
        for (let j = 0; j < 6; j++) { const crop = this.cropModels.get(plot.crop)!.clone(true); crop.position.set(-.48 + (j % 2) * .86, .2, -.53 + Math.floor(j / 2) * .49); crop.scale.setScalar(stage); crop.rotation.y = j * 1.2; plants.add(crop) }
        plants.position.copy(pos); plants.userData.index = i; this.cropRoots.add(plants)
        const el = document.createElement('div'); el.className = `plot-badge ${info.ready ? 'ready' : info.needsWater ? 'water' : ''}`
        el.dataset.plot = String(i); el.innerHTML = info.ready ? `${icon('harvest')} جاهز` : info.needsWater ? `${icon('water')} ري` : time(info.remaining)
        document.querySelector('#plot-labels')!.append(el)
        this.labels.push({ el, index: i, pos: pos.clone().add(new THREE.Vector3(0, .8, 0)) })
      }
    })
    if (this.state.plots.length > 24) this.zoomAmount = 1.2
    if (this.selected >= 0) this.selection.position.copy(this.position(this.selected)).add(new THREE.Vector3(0, .28, 0))
  }
  resize() {
    const rect = this.canvas.parentElement!.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    this.width = rect.width; this.height = rect.height
    this.renderer.setSize(this.width, this.height, false)
    const aspect = this.width / this.height
    const height = aspect < 1.3 ? 16.8 : 13.5
    this.camera.left = -height * aspect / 2; this.camera.right = height * aspect / 2; this.camera.top = height / 2; this.camera.bottom = -height / 2
    this.camera.zoom = DEFAULT_CONFIG.camera.distance / CONFIG.camera.distance / this.zoomAmount
    this.camera.updateProjectionMatrix()
  }
  zoom(direction: number) { this.zoomAmount = THREE.MathUtils.clamp(this.zoomAmount + direction * .1, .65, 1.4); this.resize() }
  resetCamera() { this.zoomAmount = 1; this.resize() }
  screenPosition(index: number) { const p = this.position(index).add(new THREE.Vector3(0, .2, 0)).project(this.camera); return { x: (p.x + 1) / 2 * this.width, y: (-p.y + 1) / 2 * this.height } }
  render(dt: number) {
    if (!this.visible || !this.width || !this.height) return
    this.elapsed += dt
    if (!this.state.settings.reducedMotion) for (const [i, plant] of this.cropRoots.children.entries()) plant.rotation.z = Math.sin(this.elapsed * 1.4 + i) * .018 * CONFIG.camera.follow / DEFAULT_CONFIG.camera.follow
    const zoom = DEFAULT_CONFIG.camera.distance / CONFIG.camera.distance / this.zoomAmount
    if (this.camera.zoom !== zoom) { this.camera.zoom = zoom; this.camera.updateProjectionMatrix() }
    this.labels.forEach(({ el, pos, index }) => { const info = plotInfo(this.state, index); if (!info.ready && !info.needsWater) el.textContent = time(info.remaining); const p = pos.clone().project(this.camera); el.style.left = `${(p.x + 1) / 2 * this.width}px`; el.style.top = `${(-p.y + 1) / 2 * this.height}px` })
    this.renderer.render(this.scene, this.camera)
  }
}
