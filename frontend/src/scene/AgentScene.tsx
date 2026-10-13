import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { AgentPosition } from '../hooks/parseAgentsMessage'
import { BuildingFootprint } from '../hooks/parseBuildingsMessage'
import { Villager } from '../hooks/mergeVillagerData'

interface AgentSceneProps {
  agents: Villager[]
  player: AgentPosition | null
  buildings: BuildingFootprint[]
  gridWidth: number
  gridHeight: number
  showGridLines: boolean
  nearbyVillager: Villager | null
  talkingVillager: Villager | null
}

export function AgentScene({
  agents,
  player,
  buildings,
  gridWidth,
  gridHeight,
  showGridLines,
  nearbyVillager,
  talkingVillager,
}: AgentSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const playerMeshRef = useRef<THREE.Mesh | null>(null)
  const buildingMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const gridLinesRef = useRef<THREE.LineSegments | null>(null)
  const promptRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const nearbyVillagerRef = useRef<Villager | null>(null)
  const talkingVillagerRef = useRef<Villager | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000,
    )

    // The larger dimension sets default framing/max zoom-out (so the whole
    // board can come into view); the smaller sets min zoom-in (so a long,
    // narrow board doesn't stop you from getting close).
    const gridSpan = Math.max(gridWidth, gridHeight)
    const gridMinSpan = Math.min(gridWidth, gridHeight)

    const cameraTarget = new THREE.Vector3(gridWidth / 2, 0, gridHeight / 2)
    const cameraDirection = new THREE.Vector3(0, gridSpan * 0.8, gridSpan * 0.8).normalize()
    const MIN_ZOOM_DISTANCE = gridMinSpan * 0.05
    const MAX_ZOOM_DISTANCE = gridSpan * 1.8
    // Slightly more than the tightest "fills the whole screen" distance,
    // so there's visible space around the board instead of it touching
    // every edge of the window.
    let cameraDistance = gridSpan * 0.65

    // How far past the town's edge you're allowed to drag the view.
    const PAN_MARGIN = gridSpan * 0.3
    const PAN_X_MIN = -PAN_MARGIN
    const PAN_X_MAX = gridWidth + PAN_MARGIN
    const PAN_Z_MIN = -PAN_MARGIN
    const PAN_Z_MAX = gridHeight + PAN_MARGIN

    const updateCameraPosition = () => {
      camera.position.copy(cameraTarget).addScaledVector(cameraDirection, cameraDistance)
      camera.lookAt(cameraTarget)
    }
    updateCameraPosition()

    // Projects a ground-plane (x, y) tile position to on-screen pixel
    // coordinates, for positioning the HTML prompt/bubble overlays above a
    // villager's head.
    const projectToScreen = (x: number, y: number) => {
      const vector = new THREE.Vector3(x + 0.5, 1.2, y + 0.5)
      vector.project(camera)
      return {
        left: ((vector.x + 1) / 2) * mount.clientWidth,
        top: ((1 - vector.y) / 2) * mount.clientHeight,
      }
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      cameraDistance = THREE.MathUtils.clamp(
        cameraDistance + event.deltaY * 0.05,
        MIN_ZOOM_DISTANCE,
        MAX_ZOOM_DISTANCE,
      )
      updateCameraPosition()
    }
    mount.addEventListener('wheel', handleWheel, { passive: false })
    mount.style.cursor = 'grab'

    // Drag (mouse or touch) slides the camera across the ground at the same fixed angle.
    const groundForward = new THREE.Vector3(
      cameraTarget.x - camera.position.x,
      0,
      cameraTarget.z - camera.position.z,
    ).normalize()
    const groundRight = groundForward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()

    let isDragging = false
    let lastPointerX = 0
    let lastPointerY = 0

    const handlePointerDown = (event: PointerEvent) => {
      isDragging = true
      lastPointerX = event.clientX
      lastPointerY = event.clientY
      mount.setPointerCapture(event.pointerId)
      mount.style.cursor = 'grabbing'
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDragging) return
      const deltaX = event.clientX - lastPointerX
      const deltaY = event.clientY - lastPointerY
      lastPointerX = event.clientX
      lastPointerY = event.clientY

      const panScale = (cameraDistance / mount.clientHeight) * 1.2
      cameraTarget.addScaledVector(groundRight, -deltaX * panScale)
      cameraTarget.addScaledVector(groundForward, deltaY * panScale)
      cameraTarget.x = THREE.MathUtils.clamp(cameraTarget.x, PAN_X_MIN, PAN_X_MAX)
      cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z, PAN_Z_MIN, PAN_Z_MAX)
      updateCameraPosition()
    }

    const handlePointerUp = (event: PointerEvent) => {
      isDragging = false
      mount.releasePointerCapture(event.pointerId)
      mount.style.cursor = 'grab'
    }

    mount.addEventListener('pointerdown', handlePointerDown)
    mount.addEventListener('pointermove', handlePointerMove)
    mount.addEventListener('pointerup', handlePointerUp)
    mount.addEventListener('pointercancel', handlePointerUp)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    mount.appendChild(renderer.domElement)

    const handleResize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(gridWidth, gridHeight),
      new THREE.MeshStandardMaterial({ color: 0x3a5a40 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(gridWidth / 2, 0, gridHeight / 2)
    scene.add(ground)

    // Built manually (rather than THREE.GridHelper, which only draws a
    // square) so the lines exactly match a non-square board's real shape.
    const gridLinePoints: number[] = []
    for (let x = 0; x <= gridWidth; x++) {
      gridLinePoints.push(x, 0.01, 0, x, 0.01, gridHeight)
    }
    for (let z = 0; z <= gridHeight; z++) {
      gridLinePoints.push(0, 0.01, z, gridWidth, 0.01, z)
    }
    const gridLineGeometry = new THREE.BufferGeometry()
    gridLineGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(gridLinePoints, 3),
    )
    const gridLines = new THREE.LineSegments(
      gridLineGeometry,
      new THREE.LineBasicMaterial({ color: 0x000000 }),
    )
    gridLines.visible = showGridLines
    scene.add(gridLines)
    gridLinesRef.current = gridLines

    const borderPoints = [
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(gridWidth, 0.02, 0),
      new THREE.Vector3(gridWidth, 0.02, gridHeight),
      new THREE.Vector3(0, 0.02, gridHeight),
      new THREE.Vector3(0, 0.02, 0),
    ]
    const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints)
    const border = new THREE.Line(
      borderGeometry,
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    )
    scene.add(border)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 20, 10)
    scene.add(directionalLight)

    let frameId: number
    const animate = () => {
      renderer.render(scene, camera)

      const promptEl = promptRef.current
      const nearby = nearbyVillagerRef.current
      if (promptEl) {
        if (nearby) {
          const { left, top } = projectToScreen(nearby.x, nearby.y)
          promptEl.style.left = `${left}px`
          promptEl.style.top = `${top}px`
          promptEl.style.display = 'block'
        } else {
          promptEl.style.display = 'none'
        }
      }

      const bubbleEl = bubbleRef.current
      const talking = talkingVillagerRef.current
      if (bubbleEl) {
        if (talking) {
          const { left, top } = projectToScreen(talking.x, talking.y)
          bubbleEl.style.left = `${left}px`
          bubbleEl.style.top = `${top}px`
          bubbleEl.style.display = 'block'
          bubbleEl.textContent = `${talking.name}: ${talking.line}`
        } else {
          bubbleEl.style.display = 'none'
        }
      }

      frameId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      mount.removeEventListener('wheel', handleWheel)
      mount.removeEventListener('pointerdown', handlePointerDown)
      mount.removeEventListener('pointermove', handlePointerMove)
      mount.removeEventListener('pointerup', handlePointerUp)
      mount.removeEventListener('pointercancel', handlePointerUp)
      cancelAnimationFrame(frameId)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
      meshesRef.current.clear()
      playerMeshRef.current = null
      buildingMeshesRef.current.clear()
      gridLinesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (gridLinesRef.current) {
      gridLinesRef.current.visible = showGridLines
    }
  }, [showGridLines])

  useEffect(() => {
    nearbyVillagerRef.current = nearbyVillager
  }, [nearbyVillager])

  useEffect(() => {
    talkingVillagerRef.current = talkingVillager
  }, [talkingVillager])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const seenIds = new Set(agents.map((agent) => agent.id))

    for (const [id, mesh] of meshesRef.current) {
      if (!seenIds.has(id)) {
        scene.remove(mesh)
        meshesRef.current.delete(id)
      }
    }

    for (const agent of agents) {
      let mesh = meshesRef.current.get(agent.id)
      if (!mesh) {
        const geometry = new THREE.IcosahedronGeometry(0.4, 0)
        const material = new THREE.MeshStandardMaterial({ color: 0xe8a87c })
        mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)
        meshesRef.current.set(agent.id, mesh)
      }
      mesh.position.set(agent.x + 0.5, 0.5, agent.y + 0.5)
    }
  }, [agents])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (!player) {
      if (playerMeshRef.current) {
        scene.remove(playerMeshRef.current)
        playerMeshRef.current = null
      }
      return
    }

    let mesh = playerMeshRef.current
    if (!mesh) {
      const geometry = new THREE.TetrahedronGeometry(0.5, 0)
      const material = new THREE.MeshStandardMaterial({ color: 0xffff00 })
      mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)
      playerMeshRef.current = mesh
    }
    mesh.position.set(player.x + 0.5, 0.5, player.y + 0.5)
  }, [player])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    for (const building of buildings) {
      if (buildingMeshesRef.current.has(building.id)) continue
      const geometry = new THREE.BoxGeometry(building.width, 2, building.height)
      const material = new THREE.MeshStandardMaterial({ color: 0x808080 })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(
        building.x + building.width / 2,
        1,
        building.y + building.height / 2,
      )
      scene.add(mesh)
      buildingMeshesRef.current.set(building.id, mesh)
    }
  }, [buildings])

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <div
        ref={promptRef}
        style={{
          position: 'absolute',
          transform: 'translate(-50%, -100%)',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'sans-serif',
          display: 'none',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Press E
      </div>
      <div
        ref={bubbleRef}
        style={{
          position: 'absolute',
          transform: 'translate(-50%, -100%)',
          background: 'white',
          color: '#1a1a2e',
          padding: '6px 10px',
          borderRadius: '8px',
          fontSize: '13px',
          fontFamily: 'sans-serif',
          maxWidth: '220px',
          display: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
