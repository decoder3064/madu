import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { AgentPosition } from '../hooks/parseAgentsMessage'
import { TownEntity } from '../hooks/parseTownMessage'
import { Villager } from '../hooks/mergeVillagerData'
import { RouteTile } from '../hooks/parseRoutesMessage'
import { viewYaw } from '../hooks/viewRotation'
import { PLAYER_TARGET } from '../CameraPicker'
import { landRectangles } from './landRectangles'

const SEA_LEVEL = -0.4
const ISLAND_DEPTH = 3
const DIRT_COLOR = 0x7a5a3c

// Flat kinds get a tiny lift each so overlapping floors don't flicker; the dock sits above the sea.
const KIND_STYLES: Record<string, { color: number; height: number; lift: number }> = {
  zone: { color: 0xd9c38c, height: 0, lift: 0.01 },
  water: { color: 0x2b6cb0, height: 0, lift: SEA_LEVEL },
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

// Brightness steps every surface snaps to: shadow, mid, lit.
const TOON_STEPS = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat)
TOON_STEPS.minFilter = THREE.NearestFilter
TOON_STEPS.magFilter = THREE.NearestFilter
TOON_STEPS.generateMipmaps = false
TOON_STEPS.needsUpdate = true

// Front faces cast shadows so a shadow starts right at a wall's base instead of leaving a lit seam.
function toonMaterial(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: TOON_STEPS, shadowSide: THREE.FrontSide })
}

const WATER_BANDS = 5.0
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
      .replace(
        '#include <opaque_fragment>',
        `float brightness = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
float steppedBrightness = ceil(brightness * ${WATER_BANDS.toFixed(1)}) / ${WATER_BANDS.toFixed(1)};
outgoingLight *= steppedBrightness / max(brightness, 0.001);
#include <opaque_fragment>`,
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

const OUTLINE_DARKEN = 0.8
const CREASE_DARKEN = 1.0
// A depth jump counts as an edge only past this many pixels' worth. Flat ground tilted at 30 degrees
// rises about 1.7 pixels' worth per pixel, so anything below that would outline the whole floor.
const OUTLINE_DEPTH_GAP_PIXELS = 2.5
// Faces meeting more sharply than this get a crease line.
const CREASE_NORMAL_DOT = 0.7

const OUTLINE_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

const OUTLINE_FRAGMENT = `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 texel;
uniform float depthGap;
varying vec2 vUv;

void checkNeighbor(vec2 offset, float depth, vec3 normal, inout float outline, inout float crease) {
  vec2 neighborUv = vUv + offset * texel;
  float neighborDepth = texture2D(tDepth, neighborUv).x;
  vec3 neighborNormal = texture2D(tNormal, neighborUv).xyz * 2.0 - 1.0;
  // Only the nearer side of an edge darkens, so outlines stay one pixel wide.
  if (neighborDepth - depth > depthGap) {
    outline = 1.0;
  } else if (abs(neighborDepth - depth) < depthGap && dot(normal, neighborNormal) < ${CREASE_NORMAL_DOT.toFixed(2)}) {
    crease = 1.0;
  }
}

void main() {
  vec4 color = texture2D(tColor, vUv);
  float depth = texture2D(tDepth, vUv).x;
  vec3 normal = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
  float outline = 0.0;
  float crease = 0.0;
  checkNeighbor(vec2(1.0, 0.0), depth, normal, outline, crease);
  checkNeighbor(vec2(-1.0, 0.0), depth, normal, outline, crease);
  checkNeighbor(vec2(0.0, 1.0), depth, normal, outline, crease);
  checkNeighbor(vec2(0.0, -1.0), depth, normal, outline, crease);
  if (outline > 0.0) {
    color.rgb *= ${OUTLINE_DARKEN.toFixed(2)};
  } else if (crease > 0.0) {
    color.rgb *= ${CREASE_DARKEN.toFixed(2)};
  }
  gl_FragColor = color;
}`

// Half the height of the sharp band, as a fraction of the screen.
const FOCUS_HALF_HEIGHT = 0.18
const MAX_BLUR_PIXELS = 3.0
const SATURATION = 1.1
const VIGNETTE_STRENGTH = 0.25

const TILT_SHIFT_FRAGMENT = `
uniform sampler2D tScene;
uniform vec2 texel;
varying vec2 vUv;

vec3 sampleAt(vec2 offset) {
  return texture2D(tScene, vUv + offset * texel).rgb;
}

void main() {
  float distanceFromFocus = abs(vUv.y - 0.5);
  float blur = smoothstep(${FOCUS_HALF_HEIGHT.toFixed(2)}, 0.5, distanceFromFocus) * ${MAX_BLUR_PIXELS.toFixed(1)};
  vec3 color = sampleAt(vec2(0.0));
  if (blur > 0.5) {
    vec3 sum = color;
    float count = 1.0;
    // Two rings of 8 samples; each lands on a whole art pixel, so the blur stays pixelated.
    for (int i = 0; i < 8; i++) {
      float angle = float(i) * 0.785398;
      vec2 direction = vec2(cos(angle), sin(angle));
      sum += sampleAt(direction * blur);
      sum += sampleAt(direction * blur * 0.5);
      count += 2.0;
    }
    color = sum / count;
  }
  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(gray), color, ${SATURATION.toFixed(2)});
  float vignette = 1.0 - ${VIGNETTE_STRENGTH.toFixed(2)} * smoothstep(0.3, 0.75, length(vUv - 0.5));
  gl_FragColor = vec4(color * vignette, 1.0);
  #include <colorspace_fragment>
}`


const TURN_SPEED = 8
const ZOOM_STEP = 1.25
const ZOOM_SPEED = 10
// About 30 degrees down gives the 2:1 pixel slopes isometric pixel art uses.
const ISO_PITCH = Math.PI / 6

// How quickly the camera catches up to who it follows; higher is snappier.
const FOLLOW_SMOOTHING = 4
// A press counts as a drag only after moving this far, so clicks stay clicks.
const DRAG_THRESHOLD_PX = 4
const PICK_RADIUS_PX = 24

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
  viewTurns: number
  followTarget: string | null
  onFollowChange: (target: string | null) => void
  zoomLevel: number
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
  viewTurns,
  followTarget,
  onFollowChange,
  zoomLevel,
}: AgentSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const overlaySceneRef = useRef<THREE.Scene | null>(null)
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const playerMeshRef = useRef<THREE.Mesh | null>(null)
  const townMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const townLabelsRef = useRef<{ entity: TownEntity; element: HTMLDivElement }[]>([])
  const labelLayerRef = useRef<HTMLDivElement>(null)
  const followTargetRef = useRef(followTarget)
  const onFollowChangeRef = useRef(onFollowChange)
  const zoomLevelRef = useRef(zoomLevel)

  useEffect(() => {
    zoomLevelRef.current = zoomLevel
  }, [zoomLevel])

  useEffect(() => {
    followTargetRef.current = followTarget
  }, [followTarget])

  useEffect(() => {
    onFollowChangeRef.current = onFollowChange
  }, [onFollowChange])
  const routeLinesRef = useRef<THREE.Line[]>([])
  const gridLinesRef = useRef<THREE.LineSegments | null>(null)
  const promptRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const nearbyVillagerRef = useRef<Villager | null>(null)
  const talkingVillagerRef = useRef<Villager | null>(null)
  const targetYawRef = useRef(viewYaw(0))

  useEffect(() => {
    targetYawRef.current = viewYaw(viewTurns)
  }, [viewTurns])

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
    // With no perspective, distance only has to keep the whole board in front of the camera.
    const CAMERA_BACKOFF = gridSpan * 2
    const MIN_VIEW_HEIGHT = gridMinSpan * 0.1
    const MAX_VIEW_HEIGHT = gridSpan * 1.3
    const DEFAULT_VIEW_HEIGHT = gridSpan * 0.6
    let viewHeight = DEFAULT_VIEW_HEIGHT

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

    let currentYaw = targetYawRef.current
    const cameraDirection = new THREE.Vector3()
    const screenRight = new THREE.Vector3()
    const screenUp = new THREE.Vector3()
    const groundForward = new THREE.Vector3()
    const groundRight = new THREE.Vector3()
    const worldUp = new THREE.Vector3(0, 1, 0)

    const applyYaw = (yaw: number) => {
      cameraDirection.set(
        Math.sin(yaw) * Math.cos(ISO_PITCH),
        Math.sin(ISO_PITCH),
        Math.cos(yaw) * Math.cos(ISO_PITCH),
      )
      camera.position.copy(cameraTarget).addScaledVector(cameraDirection, CAMERA_BACKOFF)
      camera.lookAt(cameraTarget)
      camera.updateMatrixWorld()
      screenRight.setFromMatrixColumn(camera.matrixWorld, 0)
      screenUp.setFromMatrixColumn(camera.matrixWorld, 1)
      groundForward.set(-cameraDirection.x, 0, -cameraDirection.z).normalize()
      groundRight.copy(groundForward).cross(worldUp).normalize()
    }
    applyYaw(currentYaw)

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
    }
    mount.addEventListener('wheel', handleWheel, { passive: false })
    mount.style.cursor = 'grab'

    const screenPositionOf = (position: THREE.Vector3) => {
      const vector = position.clone().project(camera)
      return {
        left: ((vector.x + 1) / 2) * mount.clientWidth,
        top: ((1 - vector.y) / 2) * mount.clientHeight,
      }
    }

    const followedMesh = () => {
      const target = followTargetRef.current
      if (target === null) return null
      if (target === PLAYER_TARGET) return playerMeshRef.current
      return meshesRef.current.get(target) ?? null
    }

    const pickAt = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const candidates: [string, THREE.Mesh][] = Array.from(meshesRef.current.entries())
      if (playerMeshRef.current) candidates.push([PLAYER_TARGET, playerMeshRef.current])

      let picked: string | null = null
      let closest = PICK_RADIUS_PX
      for (const [id, mesh] of candidates) {
        const spot = screenPositionOf(mesh.position)
        const distance = Math.hypot(spot.left - x, spot.top - y)
        if (distance < closest) {
          picked = id
          closest = distance
        }
      }
      if (picked !== null) onFollowChangeRef.current(picked)
    }

    let isDragging = false
    let pointerIsDown = false
    let downX = 0
    let downY = 0
    let lastPointerX = 0
    let lastPointerY = 0

    const handlePointerDown = (event: PointerEvent) => {
      pointerIsDown = true
      isDragging = false
      downX = lastPointerX = event.clientX
      downY = lastPointerY = event.clientY
      mount.setPointerCapture(event.pointerId)
      mount.style.cursor = 'grabbing'
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerIsDown) return
      if (!isDragging) {
        if (Math.hypot(event.clientX - downX, event.clientY - downY) < DRAG_THRESHOLD_PX) return
        isDragging = true
        onFollowChangeRef.current(null)
      }
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
      if (pointerIsDown && !isDragging) pickAt(event)
      pointerIsDown = false
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
    renderer.shadowMap.type = THREE.BasicShadowMap
    mount.appendChild(renderer.domElement)

    // Dev overlays draw on their own full-resolution canvas so they stay thin and crisp over the pixel art.
    const overlayScene = new THREE.Scene()
    overlaySceneRef.current = overlayScene
    const overlayRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    overlayRenderer.setPixelRatio(window.devicePixelRatio)
    Object.assign(overlayRenderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
    })
    mount.appendChild(overlayRenderer.domElement)

    const colorTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    })
    colorTarget.depthTexture = new THREE.DepthTexture(1, 1)
    const normalTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    })
    const normalMaterial = new THREE.MeshNormalMaterial()
    const outlineMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: colorTarget.texture },
        tDepth: { value: colorTarget.depthTexture },
        tNormal: { value: normalTarget.texture },
        texel: { value: new THREE.Vector2() },
        depthGap: { value: 0 },
      },
      vertexShader: OUTLINE_VERTEX,
      fragmentShader: OUTLINE_FRAGMENT,
    })
    const outlineScene = new THREE.Scene()
    outlineScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), outlineMaterial))
    const outlineCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const outlinedTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    })
    const tiltShiftMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: outlinedTarget.texture },
        texel: { value: new THREE.Vector2() },
      },
      vertexShader: OUTLINE_VERTEX,
      fragmentShader: TILT_SHIFT_FRAGMENT,
    })
    const tiltShiftScene = new THREE.Scene()
    tiltShiftScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), tiltShiftMaterial))

    const handleResize = () => {
      const { width, height } = artSize()
      updateCameraFrame()
      renderer.setSize(width * PIXEL_SIZE, height * PIXEL_SIZE)
      overlayRenderer.setSize(width * PIXEL_SIZE, height * PIXEL_SIZE)
      colorTarget.setSize(width, height)
      normalTarget.setSize(width, height)
      outlineMaterial.uniforms.texel.value.set(1 / width, 1 / height)
      outlinedTarget.setSize(width, height)
      tiltShiftMaterial.uniforms.texel.value.set(1 / width, 1 / height)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

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
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    )
    gridLines.visible = showGridLines
    overlayScene.add(gridLines)
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
    overlayScene.add(border)

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
    sun.shadow.bias = -0.002
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
      if (currentYaw !== targetYawRef.current) {
        const remaining = targetYawRef.current - currentYaw
        // Land exactly on the target so pixel snapping returns to a fixed grid after the turn.
        currentYaw =
          Math.abs(remaining) < 0.001
            ? targetYawRef.current
            : currentYaw + remaining * Math.min(1, delta * TURN_SPEED)
        applyYaw(currentYaw)
        updateCameraPosition()
      }

      const targetViewHeight = THREE.MathUtils.clamp(
        DEFAULT_VIEW_HEIGHT / ZOOM_STEP ** zoomLevelRef.current,
        MIN_VIEW_HEIGHT,
        MAX_VIEW_HEIGHT,
      )
      if (viewHeight !== targetViewHeight) {
        const remaining = targetViewHeight - viewHeight
        viewHeight =
          Math.abs(remaining) < 0.01
            ? targetViewHeight
            : viewHeight + remaining * Math.min(1, delta * ZOOM_SPEED)
        updateCameraFrame()
      }
      WATER_TIME.value = clock.elapsedTime
      for (const mesh of meshesRef.current.values()) {
        glide(mesh, delta, clock.elapsedTime)
      }
      if (playerMeshRef.current) {
        glide(playerMeshRef.current, delta, clock.elapsedTime)
      }

      const followed = followedMesh()
      if (followed && !isDragging) {
        const ease = 1 - Math.exp(-delta * FOLLOW_SMOOTHING)
        cameraTarget.x += (followed.position.x - cameraTarget.x) * ease
        cameraTarget.z += (followed.position.z - cameraTarget.z) * ease
        updateCameraPosition()
      }

      const worldPerPixel = viewHeight / artSize().height
      // The isometric camera stores depth evenly from near to far, so a world gap divides straight in.
      outlineMaterial.uniforms.depthGap.value =
        (worldPerPixel * OUTLINE_DEPTH_GAP_PIXELS) / (camera.far - camera.near)

      renderer.setRenderTarget(colorTarget)
      renderer.render(scene, camera)
      scene.overrideMaterial = normalMaterial
      renderer.setRenderTarget(normalTarget)
      renderer.render(scene, camera)
      scene.overrideMaterial = null
      renderer.setRenderTarget(outlinedTarget)
      renderer.render(outlineScene, outlineCamera)
      renderer.setRenderTarget(null)
      renderer.render(tiltShiftScene, outlineCamera)
      overlayRenderer.render(overlayScene, camera)

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
      mount.removeChild(overlayRenderer.domElement)
      overlayRenderer.dispose()
      colorTarget.dispose()
      normalTarget.dispose()
      normalMaterial.dispose()
      outlineMaterial.dispose()
      outlinedTarget.dispose()
      tiltShiftMaterial.dispose()
      overlaySceneRef.current = null
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
    const overlayScene = overlaySceneRef.current
    if (!overlayScene) return

    for (const line of routeLinesRef.current) {
      overlayScene.remove(line)
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
      overlayScene.add(line)
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
        const material = toonMaterial(0xe8a87c)
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
      const material = toonMaterial(0xffff00)
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

    if (town.length > 0 && !townMeshesRef.current.has('land-0')) {
      // The dock sits over water, so it leaves a gap in the land like the sea does.
      const seaAreas = town.filter((entity) => entity.kind === 'water' || entity.kind === 'dock')
      const grass = toonMaterial(GRASS_COLOR)
      const dirt = toonMaterial(DIRT_COLOR)
      // Box faces in order: east, west, top, bottom, south, north. Only the top is grass.
      const landFaces = [dirt, dirt, grass, dirt, dirt, dirt]
      const land = landRectangles(gridWidth, gridHeight, seaAreas)
      for (let index = 0; index < land.length; index++) {
        const rect = land[index]
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(rect.width, ISLAND_DEPTH, rect.height),
          landFaces,
        )
        block.position.set(rect.x + rect.width / 2, -ISLAND_DEPTH / 2, rect.y + rect.height / 2)
        block.receiveShadow = true
        scene.add(block)
        townMeshesRef.current.set(`land-${index}`, block)
      }
    }

    for (const entity of town) {
      if (townMeshesRef.current.has(entity.id)) continue
      const style = KIND_STYLES[entity.kind] ?? UNKNOWN_KIND_STYLE
      const isWater = entity.kind === 'water'
      const material = isWater ? makeWaterMaterial(style.color) : toonMaterial(style.color)
      const centerX = entity.x + entity.width / 2
      const centerZ = entity.y + entity.height / 2

      let mesh: THREE.Mesh
      if (style.height > 0) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(entity.width, style.height + ISLAND_DEPTH, entity.height),
          material,
        )
        mesh.position.set(centerX, (style.height - ISLAND_DEPTH) / 2, centerZ)
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
      // Only floors receive shadows; buildings receiving them would darken their own walls.
      mesh.receiveShadow = style.height === 0
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
