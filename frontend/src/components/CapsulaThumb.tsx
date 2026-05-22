import { lazy, Suspense } from 'react'
import { useTranslate } from '../services/useTranslate'

type ThumbCapsule = {
  id: string
  nombre: string
  thumbnailUrl?: string
  modelUrl?: string
}

type CapsulaThumbProps = {
  capsula: ThumbCapsule
  onOpen: (capsuleId: string) => void
}

const LazyCapsulaThumb3D = lazy(() => import('./CapsulaThumb3D'))

function getInitial(name: string) {
  const value = name.trim()
  return value ? value.charAt(0).toUpperCase() : '?'
}

function isGltfModel(url: string) {
  const clean = url.split('?')[0].toLowerCase()
  return clean.endsWith('.glb') || clean.endsWith('.gltf')
}

function isVideoUrl(url: string) {
  const clean = String(url || '').split('?')[0].toLowerCase()
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(clean)
}

function CapsulaThumb({ capsula, onOpen }: CapsulaThumbProps) {
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const title = capsula.nombre || 'Capsula'

  return (
    <button
      type="button"
      className="capsula-thumb-button"
      aria-label={`${txt('Abrir capsula', 'Open capsule')} ${title}`}
      onClick={() => onOpen(capsula.id)}
    >
      {capsula.thumbnailUrl ? (
        isVideoUrl(capsula.thumbnailUrl) ? (
          <video className="capsula-thumb" src={capsula.thumbnailUrl} muted playsInline loop preload="metadata" />
        ) : (
          <img className="capsula-thumb" src={capsula.thumbnailUrl} alt={title} loading="lazy" />
        )
      ) : capsula.modelUrl && isGltfModel(capsula.modelUrl) ? (
        <Suspense fallback={<div className="capsula-thumb capsula-thumb--loading"><span className="capsula-thumb-spinner" /></div>}>
          <LazyCapsulaThumb3D modelUrl={capsula.modelUrl} title={title} />
        </Suspense>
      ) : (
        <div className="capsula-thumb capsula-thumb--fallback" aria-label={`${txt('Sin miniatura para', 'No thumbnail for')} ${title}`}>
          <span>{getInitial(title)}</span>
        </div>
      )}
    </button>
  )
}

export type { ThumbCapsule }
export default CapsulaThumb
