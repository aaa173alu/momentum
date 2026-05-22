import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { usePreferences } from '../context/PreferencesContext'

interface Model3DViewerProps {
  modelPath: string
  backgroundColor?: string
}

export function Model3DViewer({ modelPath, backgroundColor = '#13131f' }: Model3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { preferences } = usePreferences()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const container = containerRef.current
    if (!container) return

    const isTransparent = backgroundColor === 'transparent'

    // Scene
    const scene = new THREE.Scene()

    // Camera
    const w = container.clientWidth || 300
    const h = container.clientHeight || 300
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000)
    camera.position.set(0, 0, 5)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: isTransparent })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(w, h)
    if (isTransparent) {
      renderer.setClearColor(0x000000, 0)
    } else {
      renderer.setClearColor(new THREE.Color(backgroundColor), 1)
    }
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;cursor:grab'
    container.appendChild(renderer.domElement)

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8)
    keyLight.position.set(5, 10, 5)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight.position.set(-5, -5, -5)
    scene.add(fillLight)

    // Controls
    const controls = new TrackballControls(camera, renderer.domElement)
    controls.noPan = true
    controls.noZoom = true
    controls.rotateSpeed = 2.4
    controls.dynamicDampingFactor = 0.12

    // Load model
    const loader = new GLTFLoader()
    loader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene

        // Center and scale using the full scene bounding box
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())

        model.position.sub(center)
        const maxDim = Math.max(size.x, size.y, size.z, 0.001)
        model.scale.setScalar(2.4 / maxDim)

        scene.add(model)
        setIsLoading(false)
      },
      undefined,
      (err) => {
        console.error('Model3DViewer: error loading model', err)
        setIsLoading(false)
      },
    )

    // Animation — keep the ID so we can cancel it on cleanup
    let animId: number
    const animate = () => {
      // If reduce animations is enabled, only render once without continuous loop
      if (preferences.reduceAnimations) {
        controls.update()
        renderer.render(scene, camera)
        return
      }
      
      // Normal animation loop
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize
    const onResize = () => {
      const nw = container.clientWidth
      const nh = container.clientHeight
      if (!nw || !nh) return
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh, false)
      controls.handleResize()
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [modelPath, backgroundColor, preferences.reduceAnimations])

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {isLoading && (
        <div className="model3d-loading-overlay">
          <div className="model3d-spinner" />
        </div>
      )}
    </div>
  )
}
