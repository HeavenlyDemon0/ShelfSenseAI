import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Eye, Rotate3d, Compass, AlertTriangle, CheckCircle, Info } from 'lucide-react'

export default function DigitalTwin3D({
  state,
  planogram,
  onRefresh,
}) {
  const mountRef = useRef(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [showZones, setShowZones] = useState(true)
  const [cameraMode, setCameraMode] = useState('perspective')

  const controlsRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const zonesGroupRef = useRef(null)
  const productsGroupRef = useRef(null)
  const animFrameRef = useRef(null)

  // Shelf dimensions in 3D units
  // Top deck: y = 1.35, Bottom shelf: y = 0.45
  // Left: x = -0.75, Right: x = 0.75
  const detections = state?.detections || []
  const products = state?.products || { CocaCola: 1, KitKat: 3, Lays: 1, Oreo: 1 }
  const misplacements = state?.planogram?.misplacements || []
  const alerts = state?.alerts || []

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    // Scene & Camera
    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.background = new THREE.Color(0x060913)
    scene.fog = new THREE.FogExp2(0x060913, 0.15)

    const initialWidth = container.clientWidth || 800
    const initialHeight = container.clientHeight || 480

    const camera = new THREE.PerspectiveCamera(42, initialWidth / initialHeight, 0.1, 50)
    camera.position.set(0, 1.8, 3.8)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    rendererRef.current = renderer
    renderer.setSize(initialWidth, initialHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(0, 0.95, 0)
    controls.minDistance = 1.6
    controls.maxDistance = 6.5
    controls.maxPolarAngle = Math.PI / 2 + 0.05
    controls.autoRotate = autoRotate
    controls.autoRotateSpeed = 1.2

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85)
    scene.add(ambientLight)

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.4)
    mainLight.position.set(3, 5, 4)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.width = 1024
    mainLight.shadow.mapSize.height = 1024
    scene.add(mainLight)

    const blueFill = new THREE.DirectionalLight(0x38bdf8, 0.4)
    blueFill.position.set(-4, 2, -2)
    scene.add(blueFill)

    // LED Retail Strip lights under decks
    const topStrip = new THREE.PointLight(0xffffff, 0.8, 2.5)
    topStrip.position.set(0, 1.25, 0.3)
    scene.add(topStrip)

    const bottomStrip = new THREE.PointLight(0xffffff, 0.8, 2.5)
    bottomStrip.position.set(0, 0.35, 0.3)
    scene.add(bottomStrip)

    // 1. Build Physical Gondola / Shelf Fixture
    const fixtureGroup = new THREE.Group()
    scene.add(fixtureGroup)

    const metalFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25,
    })
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.5,
      roughness: 0.4,
    })
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.3,
      metalness: 0.9,
    })

    // 4 Upright Steel Posts
    const postGeo = new THREE.BoxGeometry(0.05, 2.2, 0.05)
    ;[
      [-1.35, 1.1, -0.45],
      [1.35, 1.1, -0.45],
      [-1.35, 1.1, 0.45],
      [1.35, 1.1, 0.45],
    ].forEach((pos) => {
      const post = new THREE.Mesh(postGeo, metalFrameMat)
      post.position.set(...pos)
      post.castShadow = true
      fixtureGroup.add(post)
    })

    // Back Pegboard Panel
    const backPanel = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 2.0, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.2, roughness: 0.8 })
    )
    backPanel.position.set(0, 1.1, -0.45)
    backPanel.receiveShadow = true
    fixtureGroup.add(backPanel)

    // Shelf Levels: Bottom Shelf (y=0.45) and Top Deck (y=1.35)
    const shelfGeo = new THREE.BoxGeometry(2.7, 0.04, 0.9)
    const priceRailGeo = new THREE.BoxGeometry(2.7, 0.03, 0.02)

    ;[0.45, 1.35].forEach((yPos) => {
      const shelf = new THREE.Mesh(shelfGeo, deckMat)
      shelf.position.set(0, yPos, 0)
      shelf.receiveShadow = true
      shelf.castShadow = true
      fixtureGroup.add(shelf)

      // Front price tag rail with glowing accent
      const rail = new THREE.Mesh(priceRailGeo, railMat)
      rail.position.set(0, yPos, 0.455)
      fixtureGroup.add(rail)
    })

    // Floor Grid shadow receiver
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshStandardMaterial({ color: 0x04060a, roughness: 0.9 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0
    floor.receiveShadow = true
    fixtureGroup.add(floor)

    // 2. Zone Floor Outlines (Snacks, Beverages, Confectionery, Biscuits)
    const zonesGroup = new THREE.Group()
    zonesGroupRef.current = zonesGroup
    scene.add(zonesGroup)

    const zoneSpecs = [
      { id: 'TOP_LEFT', name: "Top-Left: Lay's", x: -0.68, y: 1.375, z: 0, w: 1.25, d: 0.85, color: 0xeab308 },
      { id: 'TOP_RIGHT', name: 'Top-Right: Coca-Cola', x: 0.68, y: 1.375, z: 0, w: 1.25, d: 0.85, color: 0xef4444 },
      { id: 'BOTTOM_LEFT', name: 'Bottom-Left: KitKat', x: -0.68, y: 0.475, z: 0, w: 1.25, d: 0.85, color: 0xd946ef },
      { id: 'BOTTOM_RIGHT', name: 'Bottom-Right: Oreo', x: 0.68, y: 0.475, z: 0, w: 1.25, d: 0.85, color: 0x38bdf8 },
    ]

    zoneSpecs.forEach((z) => {
      // Zone boundary floor plane
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(z.w, z.d),
        new THREE.MeshBasicMaterial({
          color: z.color,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
        })
      )
      plane.rotation.x = -Math.PI / 2
      plane.position.set(z.x, z.y, z.z)
      zonesGroup.add(plane)

      // Wireframe border
      const edges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(z.w, z.d))
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: z.color, transparent: true, opacity: 0.45 })
      )
      line.rotation.x = -Math.PI / 2
      line.position.set(z.x, z.y, z.z)
      zonesGroup.add(line)
    })

    // 3. Products Group (Dynamic Rendering)
    const productsGroup = new THREE.Group()
    productsGroupRef.current = productsGroup
    scene.add(productsGroup)

    // Raycasting for interactive selection
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const handlePointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(productsGroup.children, true)

      if (intersects.length > 0) {
        let obj = intersects[0].object
        while (obj && !obj.userData?.sku && obj.parent) {
          obj = obj.parent
        }
        if (obj?.userData?.sku) {
          setSelectedProduct(obj.userData)
        }
      } else {
        setSelectedProduct(null)
      }
    }

    renderer.domElement.addEventListener('pointerdown', handlePointerDown)

    // ResizeObserver for zero-distortion container responsiveness
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          renderer.setSize(width, height)
        }
      }
    })
    resizeObserver.observe(container)

    // Animation Loop
    let lastTime = 0
    const animate = (time) => {
      animFrameRef.current = requestAnimationFrame(animate)
      const delta = (time - lastTime) * 0.001
      lastTime = time

      // Controls update with damping
      controls.update()

      // Pulse any warning beacons
      productsGroup.children.forEach((child) => {
        if (child.userData?.isMisplaced && child.userData.beacon) {
          const s = 1.0 + Math.sin(time * 0.006) * 0.15
          child.userData.beacon.scale.set(s, 1, s)
        }
      })

      renderer.render(scene, camera)
    }
    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      renderer.dispose()
    }
  }, [])

  // Update controls auto-rotation
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate
    }
  }, [autoRotate])

  // Update zone outlines visibility
  useEffect(() => {
    if (zonesGroupRef.current) {
      zonesGroupRef.current.visible = showZones
    }
  }, [showZones])

  // Re-populate 3D products whenever detections, products, or misplacements change
  useEffect(() => {
    const productsGroup = productsGroupRef.current
    if (!productsGroup) return

    // Clear old products
    while (productsGroup.children.length > 0) {
      const obj = productsGroup.children[0]
      productsGroup.remove(obj)
    }

    const misplaceMap = {}
    misplacements.forEach((m) => {
      misplaceMap[m.class_name] = m
    })

    // Lay's (Top-Left Deck: y ~ 1.62, x ~ -0.68)
    const laysCount = products.Lays || (detections.some((d) => d.class === 'Lays' || d.class_name === 'Lays') ? 1 : 0)
    if (laysCount > 0) {
      const laysGroup = new THREE.Group()
      laysGroup.position.set(-0.68, 1.62, 0)
      laysGroup.userData = {
        sku: 'Lays Classic Potato Chips',
        brand: "Lay's",
        zone: 'Top-Left Deck',
        expectedZone: 'Top-Left Deck',
        status: misplaceMap['Lays'] ? 'MISPLACED' : 'CORRECT',
        confidence: 0.91,
        units: laysCount,
      }

      // Puffy Pillow Bag Geometry
      const bagGeo = new THREE.BoxGeometry(0.34, 0.48, 0.18, 4, 4, 2)
      const bagMat = new THREE.MeshStandardMaterial({
        color: 0xeab308,
        roughness: 0.35,
        metalness: 0.1,
      })
      const bagMesh = new THREE.Mesh(bagGeo, bagMat)
      bagMesh.castShadow = true
      laysGroup.add(bagMesh)

      // Brand Logo Ribbon
      const ribbon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.02, 16),
        new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.2 })
      )
      ribbon.rotation.x = Math.PI / 2
      ribbon.position.set(0, 0.04, 0.1)
      laysGroup.add(ribbon)

      productsGroup.add(laysGroup)
    }

    // Coca-Cola (Top-Right Deck: y ~ 1.62, x ~ 0.68)
    const cokeCount = products.CocaCola || (detections.some((d) => d.class === 'CocaCola' || d.class_name === 'CocaCola') ? 1 : 0)
    if (cokeCount > 0) {
      const cokeGroup = new THREE.Group()
      cokeGroup.position.set(0.68, 1.60, 0)
      cokeGroup.userData = {
        sku: 'Coca-Cola Classic PET 500ml',
        brand: 'Coca-Cola',
        zone: 'Top-Right Deck',
        expectedZone: 'Top-Right Deck',
        status: misplaceMap['CocaCola'] ? 'MISPLACED' : 'CORRECT',
        confidence: 0.93,
        units: cokeCount,
      }

      // Bottle Geometry
      const bottleBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.42, 24),
        new THREE.MeshStandardMaterial({ color: 0x220505, roughness: 0.1, metalness: 0.2 })
      )
      bottleBody.castShadow = true
      cokeGroup.add(bottleBody)

      // Red Label Banner
      const label = new THREE.Mesh(
        new THREE.CylinderGeometry(0.112, 0.112, 0.16, 24),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
      )
      label.position.y = 0.02
      cokeGroup.add(label)

      // Bottle Cap
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16),
        new THREE.MeshStandardMaterial({ color: 0xdc2626 })
      )
      cap.position.y = 0.235
      cokeGroup.add(cap)

      productsGroup.add(cokeGroup)
    }

    // KitKat Multi-Pack Cluster (Bottom-Left: y ~ 0.65, x ~ -0.68)
    // Decomposed into 3 distinct physical chocolate wafer bars!
    const kitkatUnits = products.KitKat || 3
    const kitkatGroup = new THREE.Group()
    kitkatGroup.position.set(-0.68, 0.65, 0)
    kitkatGroup.userData = {
      sku: 'KitKat 2-Finger Milk Chocolate Wafer',
      brand: 'KitKat',
      zone: 'Bottom-Left Shelf',
      expectedZone: 'Bottom-Left Shelf',
      status: misplaceMap['KitKat'] ? 'MISPLACED' : 'CORRECT',
      confidence: 0.94,
      units: kitkatUnits,
    }

    const barGeo = new THREE.BoxGeometry(0.085, 0.34, 0.07)
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xd946ef,
      roughness: 0.3,
      metalness: 0.15,
    })

    for (let i = 0; i < kitkatUnits; i++) {
      const bar = new THREE.Mesh(barGeo, barMat)
      bar.position.set(-0.12 + i * 0.12, 0, (i % 2 === 0 ? 0.01 : -0.01))
      bar.castShadow = true
      kitkatGroup.add(bar)
    }
    productsGroup.add(kitkatGroup)

    // Oreo (Bottom-Right: y ~ 0.65, x ~ 0.68)
    const oreoCount = products.Oreo || (detections.some((d) => d.class === 'Oreo' || d.class_name === 'Oreo') ? 1 : 0)
    if (oreoCount > 0) {
      const oreoGroup = new THREE.Group()
      oreoGroup.position.set(0.68, 0.62, 0)
      oreoGroup.userData = {
        sku: 'Oreo Vanilla Creme Sandwich Roll',
        brand: 'Oreo',
        zone: 'Bottom-Right Shelf',
        expectedZone: 'Bottom-Right Shelf',
        status: misplaceMap['Oreo'] ? 'MISPLACED' : 'CORRECT',
        confidence: 0.88,
        units: oreoCount,
      }

      // Cylindrical horizontal cookie roll
      const roll = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.42, 24),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.2 })
      )
      roll.rotation.z = Math.PI / 2
      roll.castShadow = true
      oreoGroup.add(roll)

      // Cookie dark wafer ends
      const endMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
      ;[-0.21, 0.21].forEach((xPos) => {
        const end = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.02, 24), endMat)
        end.rotation.z = Math.PI / 2
        end.position.x = xPos
        oreoGroup.add(end)
      })

      productsGroup.add(oreoGroup)
    }

    // Attach Warning Beacons for any Misplaced Items
    productsGroup.children.forEach((group) => {
      const isMis = misplaceMap[group.userData.brand]
      if (isMis) {
        group.userData.isMisplaced = true
        // Translucent holographic beacon cylinder
        const beacon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.24, 0.7, 16, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0xef4444,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
          })
        )
        beacon.position.y = 0.05
        group.userData.beacon = beacon
        group.add(beacon)
      }
    })
  }, [detections, products, misplacements])

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 1.8, 3.8)
      controlsRef.current.target.set(0, 0.95, 0)
      controlsRef.current.update()
    }
  }

  const setFrontView = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 0.95, 3.4)
      controlsRef.current.target.set(0, 0.95, 0)
      controlsRef.current.update()
    }
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#060913] shadow-2xl">
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={mountRef}
        className="w-full h-[520px] cursor-grab active:cursor-grabbing"
      />

      {/* Floating 3D Control HUD Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 backdrop-blur-md flex items-center gap-1.5">
          <Rotate3d className="w-3.5 h-3.5 animate-spin-slow" />
          <span>Interactive 3D Digital Twin</span>
        </span>

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border transition-all ${
            autoRotate
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
          }`}
        >
          {autoRotate ? 'Auto-Rotate ON' : 'Auto-Rotate OFF'}
        </button>

        <button
          onClick={() => setShowZones(!showZones)}
          className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border transition-all ${
            showZones
              ? 'bg-white text-black border-white shadow-sm'
              : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
          }`}
        >
          {showZones ? 'Zone Grid ON' : 'Zone Grid OFF'}
        </button>

        <button
          onClick={setFrontView}
          className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 backdrop-blur-md transition-all flex items-center gap-1"
        >
          <Eye className="w-3 h-3" />
          <span>Front View</span>
        </button>

        <button
          onClick={resetCamera}
          className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 backdrop-blur-md transition-all flex items-center gap-1"
        >
          <Compass className="w-3 h-3" />
          <span>Reset Angle</span>
        </button>
      </div>

      {/* Interaction Hint */}
      <div className="absolute bottom-4 left-4 z-10 text-[11px] text-slate-400 bg-black/60 px-3 py-1.5 rounded-lg border border-white/5 backdrop-blur-md flex items-center gap-2">
        <span>Drag to rotate</span>
        <span className="text-slate-600">|</span>
        <span>Scroll to zoom</span>
        <span className="text-slate-600">|</span>
        <span>Right-click to pan</span>
        <span className="text-slate-600">|</span>
        <span>Click item for telemetry</span>
      </div>

      {/* Product Telemetry Inspection Drawer (Click-to-Inspect) */}
      {selectedProduct && (
        <div className="absolute top-4 right-4 z-20 w-80 p-5 rounded-2xl bg-slate-900/90 border border-white/15 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-right duration-200">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-[10px] uppercase font-black text-cyan-400 tracking-wider">3D Object Telemetry</span>
              <h3 className="text-base font-bold text-white">{selectedProduct.sku}</h3>
            </div>
            <button
              onClick={() => setSelectedProduct(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-white/5"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Current Zone:</span>
              <span className="font-semibold text-slate-200">{selectedProduct.zone}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Expected Zone:</span>
              <span className="font-semibold text-slate-200">{selectedProduct.expectedZone}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Estimated Units:</span>
              <span className="font-bold text-cyan-300 font-mono">{selectedProduct.units} units</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Inference Confidence:</span>
              <span className="font-mono text-emerald-400">{(selectedProduct.confidence * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Status:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedProduct.status === 'MISPLACED'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {selectedProduct.status === 'MISPLACED' ? 'MISPLACED' : 'COMPLIANT'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

