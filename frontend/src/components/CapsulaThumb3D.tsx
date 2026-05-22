import type { CSSProperties } from 'react'
import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

type CapsulaThumb3DProps = {
  modelUrl: string
  title?: string
  className?: string
  style?: CSSProperties
}

function ModelMesh({ url }: { url: string }) {
  const gltf = useGLTF(url)

  const scene = useMemo(() => {
    const s = gltf.scene.clone()
    const box = new THREE.Box3().setFromObject(s)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    s.position.sub(center)
    s.scale.setScalar(2.4 / maxDim)
    return s
  }, [gltf])

  return <primitive object={scene} />
}

function CapsulaThumb3D({ modelUrl, title = 'Modelo 3D', className, style }: CapsulaThumb3DProps) {
  return (
    <div
      className={`capsula-thumb capsula-thumb--3d${className ? ` ${className}` : ''}`}
      aria-label={`Miniatura 3D de ${title}`}
      data-model-url={modelUrl}
      style={style}
    >
      <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[1.2, 1.8, 2.4]} intensity={1.1} />
        <Suspense fallback={null}>
          <ModelMesh url={modelUrl} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default CapsulaThumb3D
