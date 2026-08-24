import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { AgentPosition } from '../hooks/parseAgentsMessage'

const GRID_SIZE = 20

interface AgentSceneProps {
  agents: AgentPosition[]
  player: AgentPosition | null
}

export function AgentScene({ agents, player }: AgentSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const playerMeshRef = useRef<THREE.Mesh | null>(null)

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
    camera.position.set(GRID_SIZE / 2, 15, GRID_SIZE + 5)
    camera.lookAt(GRID_SIZE / 2, 0, GRID_SIZE / 2)

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
      new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x3a5a40 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(GRID_SIZE / 2, 0, GRID_SIZE / 2)
    scene.add(ground)

    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x000000, 0x000000)
    gridHelper.position.set(GRID_SIZE / 2, 0.01, GRID_SIZE / 2)
    scene.add(gridHelper)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 20, 10)
    scene.add(directionalLight)

    let frameId: number
    const animate = () => {
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(frameId)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
      meshesRef.current.clear()
      playerMeshRef.current = null
    }
  }, [])

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

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
}
