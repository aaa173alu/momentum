import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const THUMB_SIZE = 640

export async function render3DThumbnailFromUrl(modelUrl: string): Promise<Blob> {
  const scene = new THREE.Scene()
  scene.background = null

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)

  const ambient = new THREE.AmbientLight(0xffffff, 0.9)
  scene.add(ambient)
  const key = new THREE.DirectionalLight(0xffffff, 1.0)
  key.position.set(3, 5, 4)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffffff, 0.5)
  fill.position.set(-3, 2, -2)
  scene.add(fill)

  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(modelUrl)
  const model = gltf.scene.clone(true)
  scene.add(model)

  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  model.position.sub(center)
  const maxDim = Math.max(size.x, size.y, size.z, 0.0001)
  model.scale.setScalar(2 / maxDim)

  const distance = 3.2
  camera.position.set(distance, distance * 0.5, distance)
  camera.lookAt(0, 0, 0)

  const canvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setSize(THUMB_SIZE, THUMB_SIZE, false)
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0)
  renderer.render(scene, camera)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('Could not generate 3D thumbnail'))
    }, 'image/png')
  })

  renderer.dispose()
  return blob
}
