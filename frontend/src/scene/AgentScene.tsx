import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { AgentPosition } from '../hooks/parseAgentsMessage'
import { TownEntity } from '../hooks/parseTownMessage'
import { Villager } from '../hooks/mergeVillagerData'
import { RouteTile } from '../hooks/parseRoutesMessage'

// Flat kinds get a tiny lift each so overlapping floors don't flicker; the dock sits above the sea.
const KIND_STYLES: Record<string, { color: number; height: number; lift: number }> = {
  zone: { color: 0xd9c38c, height: 0, lift: 0.01 },
  water: { color: 0x2b6cb0, height: 0, lift: 0.02 },
  dock: { color: 0x8b5a2b, height: 0, lift: 0.03 },
  forest: { color: 0x1f4d2b, height: 1.5, lift: 0 },
  building: { color: 0x8a8a8a, height: 2, lift: 0 },
  landmark: { color: 0xc4c4c4, height: 3, lift: 0 },
}
const UNKNOWN_KIND_STYLE = { color: 0xff00ff, height: 1, lift: 0 }

// Above every floor lift so lines never tie with a floor.
const GRID_LINE_HEIGHT = 0.05
const BORDER_HEIGHT = 0.06
const ROUTE_HEIGHT = 0.15
const ROUTE_MATERIAL = new THREE.LineBasicMaterial({ color: 0xffcc00 })

const SKY_COLOR = 0xa8d4ef
const GRASS_COLOR = 0x6a9a4f
const SUN_COLOR = 0xffe0b0

const WATER_TIME = { value: 0 }

// Extends the standard lit material so the sea keeps sunlight, shadows, and fog.
// Ripples only tilt the surface for lighting; real height changes would poke through the dock and grid.
function makeWaterMaterial(color: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = WATER_TIME
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
varying vec2 vWaterPos;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `vWaterPos = position.xy;
float diagonal = 0.15 * cos((position.x + position.y) * 0.9 + uTime * 1.7);
float slopeX = 0.25 * cos(position.x * 0.6 + uTime * 1.1) + diagonal;
float slopeY = 0.25 * cos(position.y * 0.45 + uTime * 0.8) + diagonal;
vec3 objectNormal = normalize(vec3(-slopeX, -slopeY, 1.0));`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
varying vec2 vWaterPos;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float shimmer = sin(vWaterPos.x * 1.3 + uTime * 1.5) * sin(vWaterPos.y * 1.1 - uTime * 1.2);
diffuseColor.rgb += shimmer * 0.05;`,
      )
  }
  return material
}

const BODY_HEIGHT = 0.5
// Matches the server: one tile per 0.5-second tick.
const MIN_GLIDE_SPEED = 2
const CATCH_UP_RATE = 6
const SNAP_DISTANCE = 4
const BOB_SPEED = 14
const BOB_HEIGHT = 0.12
const glideDirection = new THREE.Vector3()

function glide(mesh: THREE.Mesh, delta: number, time: number) {
  const target = mesh.userData.target as THREE.Vector3 | undefined
  if (!target) return
  glideDirection.set(target.x - mesh.position.x, 0, target.z - mesh.position.z)
  const distance = glideDirection.length()
  if (distance > SNAP_DISTANCE) {
    mesh.position.set(target.x, BODY_HEIGHT, target.z)
    return
  }
  const speed = Math.max(MIN_GLIDE_SPEED, distance * CATCH_UP_RATE)
  const step = Math.min(distance, speed * delta)
  if (distance > 0) {
    mesh.position.addScaledVector(glideDirection.normalize(), step)
  }
  const stillMoving = distance - step > 0.001
  mesh.position.y = stillMoving
    ? BODY_HEIGHT + Math.abs(Math.sin(time * BOB_SPEED)) * BOB_HEIGHT
    : BODY_HEIGHT
}

// Screen pixels per art pixel. Higher is chunkier.
const PIXEL_SIZE = 3

const ISO_YAW = Math.PI / 4
// About 30 degrees down gives the 2:1 pixel slopes isometric pixel art uses.
const ISO_PITCH = Math.PI / 6

const FOLLOW_EDGE_FRACTION = 0.2
const FOLLOW_SPEED = 0.1

const LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  transform: 'translate(-50%, -50%)',
  color: 'white',
  fontSize: '11px',
  fontFamily: 'sans-serif',
  textShadow: '0 0 3px black',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
}

interface AgentSceneProps {
  agents: Villager[]
  player: AgentPosition | null
  town: TownEntity[]
  gridWidth: number
  gridHeight: number
  showGridLines: boolean
  nearbyVillager: Villager | null
  talkingVillager: Villager | null
  routes: Map<string, RouteTile[]>
  showRoutes: boolean
}

export function AgentScene({
  agents,
  player,
  town,
  gridWidth,
  gridHeight,
  showGridLines,
  nearbyVillager,
  talkingVillager,
  routes,
  showRoutes,
}: AgentSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const playerMeshRef = useRef<THREE.Mesh | null>(null)
  const townMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const townLabelsRef = useRef<{ entity: TownEntity; element: HTMLDivElement }[]>([])
  const labelLayerRef = useRef<HTMLDivElement>(null)
  const playerPositionRef = useRef<AgentPosition | null>(null)
  const followRequestedRef = useRef(false)
  const routeLinesRef = useRef<THREE.Line[]>([])
  const gridLinesRef = useRef<THREE.LineSegments | null>(null)
  const promptRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const nearbyVillagerRef = useRef<Villager | null>(null)
  const talkingVillagerRef = useRef<Villager | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(SKY_COLOR)
    sceneRef.current = scene

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)

    // The larger dimension sets default framing/max zoom-out (so the whole
    // board can come into view); the smaller sets min zoom-in (so a long,
    // narrow board doesn't stop you from getting close).
    const gridSpan = Math.max(gridWidth, gridHeight)
    const gridMinSpan = Math.min(gridWidth, gridHeight)
    const cameraTarget = new THREE.Vector3(gridWidth / 2, 0, gridHeight / 2)
    const cameraDirection = new THREE.Vector3(
      Math.sin(ISO_YAW) * Math.cos(ISO_PITCH),
      Math.sin(ISO_PITCH),
      Math.cos(ISO_YAW) * Math.cos(ISO_PITCH),
    )
    // With no perspective, distance only has to keep the whole board in front of the camera.
    const CAMERA_BACKOFF = gridSpan * 2
    const MIN_VIEW_HEIGHT = gridMinSpan * 0.1
    const MAX_VIEW_HEIGHT = gridSpan * 1.3
    let viewHeight = gridSpan * 0.6

    scene.fog = new THREE.Fog(SKY_COLOR, CAMERA_BACKOFF + gridSpan * 0.3, CAMERA_BACKOFF + gridSpan * 1.2)

    // How far past the town's edge you're allowed to drag the view.
    const PAN_MARGIN = gridSpan * 0.3
    const PAN_X_MIN = -PAN_MARGIN
    const PAN_X_MAX = gridWidth + PAN_MARGIN
    const PAN_Z_MIN = -PAN_MARGIN
    const PAN_Z_MAX = gridHeight + PAN_MARGIN

    const artSize = () => ({
      width: Math.floor(mount.clientWidth / PIXEL_SIZE),
      height: Math.floor(mount.clientHeight / PIXEL_SIZE),
    })

    // The camera never turns, so its screen directions are fixed once.
    camera.position.copy(cameraTarget).addScaledVector(cameraDirection, CAMERA_BACKOFF)
    camera.lookAt(cameraTarget)
    camera.updateMatrixWorld()
    const screenRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const screenUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)

    const updateCameraPosition = () => {
      camera.position.copy(cameraTarget).addScaledVector(cameraDirection, CAMERA_BACKOFF)
      // Snap to whole art pixels so still objects land on the same pixels every frame.
      const pixel = viewHeight / artSize().height
      const alongRight = camera.position.dot(screenRight)
      const alongUp = camera.position.dot(screenUp)
      camera.position.addScaledVector(screenRight, Math.round(alongRight / pixel) * pixel - alongRight)
      camera.position.addScaledVector(screenUp, Math.round(alongUp / pixel) * pixel - alongUp)
    }
    const updateCameraFrame = () => {
      const { width, height } = artSize()
      const aspect = width / height
      camera.left = (-viewHeight * aspect) / 2
      camera.right = (viewHeight * aspect) / 2
      camera.top = viewHeight / 2
      camera.bottom = -viewHeight / 2
      camera.far = CAMERA_BACKOFF * 3
      camera.updateProjectionMatrix()
      // A zoom changes how big an art pixel is in the world, so the snap has to be redone.
      updateCameraPosition()
    }
    updateCameraFrame()

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
      viewHeight = THREE.MathUtils.clamp(
        viewHeight + event.deltaY * 0.03,
        MIN_VIEW_HEIGHT,
        MAX_VIEW_HEIGHT,
      )
      updateCameraFrame()
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
      followRequestedRef.current = false
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

      const worldPerPixel = viewHeight / mount.clientHeight
      cameraTarget.addScaledVector(groundRight, -deltaX * worldPerPixel)
      // The ground is tilted away from the camera, so vertical drags cover more ground per pixel.
      cameraTarget.addScaledVector(groundForward, (deltaY * worldPerPixel) / Math.sin(ISO_PITCH))
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

    const renderer = new THREE.WebGLRenderer({ antialias: false })
    renderer.setPixelRatio(1 / PIXEL_SIZE)
    renderer.domElement.style.imageRendering = 'pixelated'
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const handleResize = () => {
      const { width, height } = artSize()
      updateCameraFrame()
      renderer.setSize(width * PIXEL_SIZE, height * PIXEL_SIZE)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(gridWidth, gridHeight),
      new THREE.MeshStandardMaterial({ color: GRASS_COLOR }),
    )
    ground.receiveShadow = true
    ground.rotation.x = -Math.PI / 2
    ground.position.set(gridWidth / 2, 0, gridHeight / 2)
    scene.add(ground)

    // Built manually (rather than THREE.GridHelper, which only draws a
    // square) so the lines exactly match a non-square board's real shape.
    const gridLinePoints: number[] = []
    for (let x = 0; x <= gridWidth; x++) {
      gridLinePoints.push(x, GRID_LINE_HEIGHT, 0, x, GRID_LINE_HEIGHT, gridHeight)
    }
    for (let z = 0; z <= gridHeight; z++) {
      gridLinePoints.push(0, GRID_LINE_HEIGHT, z, gridWidth, GRID_LINE_HEIGHT, z)
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
      new THREE.Vector3(0, BORDER_HEIGHT, 0),
      new THREE.Vector3(gridWidth, BORDER_HEIGHT, 0),
      new THREE.Vector3(gridWidth, BORDER_HEIGHT, gridHeight),
      new THREE.Vector3(0, BORDER_HEIGHT, gridHeight),
      new THREE.Vector3(0, BORDER_HEIGHT, 0),
    ]
    const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints)
    const border = new THREE.Line(
      borderGeometry,
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    )
    scene.add(border)

    const skyLight = new THREE.HemisphereLight(0xcfe8ff, 0x5a7d4a, 1.2)
    scene.add(skyLight)

    const sun = new THREE.DirectionalLight(SUN_COLOR, 2.2)
    sun.position.set(gridWidth / 2 - gridSpan * 0.4, gridSpan * 0.6, gridHeight / 2 - gridSpan * 0.3)
    sun.target.position.set(gridWidth / 2, 0, gridHeight / 2)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    // The shadow camera has to cover the whole board or shadows get cut off at its edge.
    const shadowReach = gridSpan * 0.75
    sun.shadow.camera.left = -shadowReach
    sun.shadow.camera.right = shadowReach
    sun.shadow.camera.top = shadowReach
    sun.shadow.camera.bottom = -shadowReach
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = gridSpan * 3
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    scene.add(sun)
    scene.add(sun.target)

    const clock = new THREE.Clock()
    const screenSpotOf = (villager: Villager) => {
      const mesh = meshesRef.current.get(villager.id)
      if (!mesh) return projectToScreen(villager.x, villager.y)
      return projectToScreen(mesh.position.x - 0.5, mesh.position.z - 0.5)
    }

    let frameId: number
    const animate = () => {
      const delta = clock.getDelta()
      WATER_TIME.value = clock.elapsedTime
      for (const mesh of meshesRef.current.values()) {
        glide(mesh, delta, clock.elapsedTime)
      }
      if (playerMeshRef.current) {
        glide(playerMeshRef.current, delta, clock.elapsedTime)
      }

      const followed = playerPositionRef.current
      if (followed && followRequestedRef.current && !isDragging) {
        const { left, top } = projectToScreen(followed.x, followed.y)
        const edgeX = mount.clientWidth * FOLLOW_EDGE_FRACTION
        const edgeY = mount.clientHeight * FOLLOW_EDGE_FRACTION
        const nearEdge =
          left < edgeX ||
          left > mount.clientWidth - edgeX ||
          top < edgeY ||
          top > mount.clientHeight - edgeY
        if (nearEdge) {
          cameraTarget.x += (followed.x + 0.5 - cameraTarget.x) * FOLLOW_SPEED
          cameraTarget.z += (followed.y + 0.5 - cameraTarget.z) * FOLLOW_SPEED
          updateCameraPosition()
        } else {
          followRequestedRef.current = false
        }
      }

      renderer.render(scene, camera)

      const promptEl = promptRef.current
      const nearby = nearbyVillagerRef.current
      if (promptEl) {
        if (nearby) {
          const { left, top } = screenSpotOf(nearby)
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
          const { left, top } = screenSpotOf(talking)
          bubbleEl.style.left = `${left}px`
          bubbleEl.style.top = `${top}px`
          bubbleEl.style.display = 'block'
          bubbleEl.textContent = `${talking.name}: ${talking.line}`
        } else {
          bubbleEl.style.display = 'none'
        }
      }

      for (const { entity, element } of townLabelsRef.current) {
        const { left, top } = projectToScreen(
          entity.x + entity.width / 2 - 0.5,
          entity.y + entity.height / 2 - 0.5,
        )
        element.style.left = `${left}px`
        element.style.top = `${top}px`
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
      townMeshesRef.current.clear()
      for (const { element } of townLabelsRef.current) element.remove()
      townLabelsRef.current = []
      routeLinesRef.current = []
      gridLinesRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    for (const line of routeLinesRef.current) {
      scene.remove(line)
      line.geometry.dispose()
    }
    routeLinesRef.current = []
    if (!showRoutes) return

    for (const agent of agents) {
      const route = routes.get(agent.id)
      if (!route || route.length === 0) continue
      const points = [new THREE.Vector3(agent.x + 0.5, ROUTE_HEIGHT, agent.y + 0.5)]
      for (const tile of route) {
        points.push(new THREE.Vector3(tile.x + 0.5, ROUTE_HEIGHT, tile.y + 0.5))
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ROUTE_MATERIAL)
      scene.add(line)
      routeLinesRef.current.push(line)
    }
  }, [routes, agents, showRoutes])

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
        mesh.castShadow = true
        scene.add(mesh)
        meshesRef.current.set(agent.id, mesh)
        mesh.position.set(agent.x + 0.5, BODY_HEIGHT, agent.y + 0.5)
      }
      mesh.userData.target = new THREE.Vector3(agent.x + 0.5, BODY_HEIGHT, agent.y + 0.5)
    }
  }, [agents])

  useEffect(() => {
    const previous = playerPositionRef.current
    // The server re-sends the player every tick, so only an actual step counts.
    if (player && (!previous || previous.x !== player.x || previous.y !== player.y)) {
      followRequestedRef.current = true
    }
    playerPositionRef.current = player

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
      mesh.castShadow = true
      scene.add(mesh)
      playerMeshRef.current = mesh
      mesh.position.set(player.x + 0.5, BODY_HEIGHT, player.y + 0.5)
    }
    mesh.userData.target = new THREE.Vector3(player.x + 0.5, BODY_HEIGHT, player.y + 0.5)
  }, [player])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const labelLayer = labelLayerRef.current
    if (!labelLayer) return

    for (const entity of town) {
      if (townMeshesRef.current.has(entity.id)) continue
      const style = KIND_STYLES[entity.kind] ?? UNKNOWN_KIND_STYLE
      const isWater = entity.kind === 'water'
      const material = isWater
        ? makeWaterMaterial(style.color)
        : new THREE.MeshStandardMaterial({ color: style.color })
      const centerX = entity.x + entity.width / 2
      const centerZ = entity.y + entity.height / 2

      let mesh: THREE.Mesh
      if (style.height > 0) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(entity.width, style.height, entity.height),
          material,
        )
        mesh.position.set(centerX, style.height / 2, centerZ)
        mesh.castShadow = true
      } else {
        const segmentsAcross = isWater ? entity.width : 1
        const segmentsDown = isWater ? entity.height : 1
        mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(entity.width, entity.height, segmentsAcross, segmentsDown),
          material,
        )
        mesh.rotation.x = -Math.PI / 2
        mesh.position.set(centerX, style.lift, centerZ)
      }
      mesh.receiveShadow = true
      scene.add(mesh)
      townMeshesRef.current.set(entity.id, mesh)

      const label = document.createElement('div')
      label.textContent = entity.name
      Object.assign(label.style, LABEL_STYLE)
      labelLayer.appendChild(label)
      townLabelsRef.current.push({ entity, element: label })
    }
  }, [town])

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}
    >
      <div
        ref={labelLayerRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
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
