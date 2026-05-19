import { Fragment, useState, useEffect, useRef } from 'react'
import type { CreateCapsuleFormState } from '../pages/CreateCapsuleFlowPage'
import { fetchCapsuleModels, uploadModel3DFile, uploadMediaFile, type ApiCapsuleModel } from '../services/api'
import { render3DThumbnailFromUrl } from '../utils/render3DThumb'
import { useTranslate } from '../services/useTranslate'

interface CreateCapsuleStep1Props {
  form: CreateCapsuleFormState
  updateForm: (updates: Partial<CreateCapsuleFormState>) => void
  onContinue: () => void
  isLoading: boolean
}

const ITEM_WIDTH = 160
const ITEM_GAP = 24
const ITEM_SPAN = ITEM_WIDTH + ITEM_GAP

type CarouselItem =
  | { type: 'model'; data: ApiCapsuleModel }
  | { type: 'custom'; data: null }

function CreateCapsuleStep1({ form, updateForm, onContinue, isLoading }: CreateCapsuleStep1Props) {
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const [models, setModels] = useState<ApiCapsuleModel[]>([])
  const [carouselIndex, setCarouselIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [loadingModels, setLoadingModels] = useState(true)
  const [uploadingFile, setUploadingFile] = useState(false)

  // Drag state
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const hasDragged = useRef(false)

  useEffect(() => {
    const loadModels = async () => {
      try {
        const fetchedModels = await fetchCapsuleModels()
        setModels(fetchedModels)
      } catch (err) {
        console.error('Error loading capsule models:', err)
      } finally {
        setLoadingModels(false)
      }
    }
    loadModels()
  }, [])

  // Auto-select the centered predefined model whenever the carousel moves
  useEffect(() => {
    if (models.length === 0) return
    if (carouselIndex < models.length) {
      const m = models[carouselIndex]
      updateForm({ modelId: m.id, modelFile: null, modelUrl: m.modelUrl, thumbnailUrl: m.thumbnailUrl })
    }
  }, [carouselIndex, models]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateForm({ title: e.target.value })
    setError('')
  }

  const handleCustomModelClick = () => {
    fileInputRef.current?.click()
  }

  const handleModelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const validExts = new Set(['glb', 'gltf', 'obj', 'fbx', 'stl'])
    if (!validExts.has(ext)) {
      setError(txt('Formato 3D no soportado. Usa .glb, .gltf, .obj, .fbx o .stl', 'Unsupported 3D format. Use .glb, .gltf, .obj, .fbx or .stl'))
      e.target.value = ''
      return
    }

    setError('')
    setUploadingFile(true)

    try {
      const response = await uploadModel3DFile(file)

      // Generar la miniatura renderizando el modelo subido y subirla a Cloudinary
      let thumbnailUrl = response.thumbnailUrl || ''
      try {
        const thumbBlob = await render3DThumbnailFromUrl(response.fileUrl)
        const thumbFile = new File([thumbBlob], 'model-thumb.png', { type: 'image/png' })
        const thumbUpload = await uploadMediaFile(thumbFile)
        thumbnailUrl = thumbUpload.fileUrl
      } catch (thumbErr) {
        console.error('No se pudo generar la miniatura del modelo 3D:', thumbErr)
      }

      updateForm({
        modelId: null,
        modelFile: null,
        modelUrl: response.fileUrl,
        thumbnailUrl,
      })
    } catch (err) {
      console.error('Error uploading 3D model:', err)
      setError(txt('Error al subir el archivo 3D', 'Error uploading 3D file'))
    } finally {
      setUploadingFile(false)
      e.target.value = ''
    }
  }

  const handleAddMedia = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,video/*'
    input.multiple = true
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files ?? []) as File[]
      if (files.length > 0) {
        updateForm({ mediaFiles: [...form.mediaFiles, ...files] })
      }
    }
    input.click()
  }

  const handleRemoveMedia = (index: number) => {
    updateForm({
      mediaFiles: form.mediaFiles.filter((_, i) => i !== index),
    })
  }

  const handleContinue = () => {
    if (!form.title.trim()) {
      setError(txt('El nombre de la cápsula es obligatorio', 'Capsule name is required'))
      return
    }

    if (!form.modelId && !form.modelUrl) {
      setError(txt('Debe seleccionar un diseño de cápsula', 'You must select a capsule design'))
      return
    }

    setError('')
    onContinue()
  }

  // Carousel drag handlers
  const onCarouselPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartX.current = e.clientX
    hasDragged.current = false
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onCarouselPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const delta = e.clientX - dragStartX.current
    if (Math.abs(delta) > 8) hasDragged.current = true
    setDragOffset(delta)
  }

  const onCarouselPointerUp = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (hasDragged.current) {
      const total = models.length + 1
      // Snap to whichever item is closest to center when released
      const steps = -Math.round(dragOffset / ITEM_SPAN)
      const newIndex = ((carouselIndex + steps) % total + total) % total
      setCarouselIndex(newIndex)
    }
    setDragOffset(0)
  }

  // Block click events that follow a drag gesture
  const onCarouselClickCapture = (e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.stopPropagation()
      hasDragged.current = false
    }
  }

  const totalItems = models.length + 1
  const nextIndex = (carouselIndex + 1) % totalItems
  const prevIndex = carouselIndex === 0 ? models.length : carouselIndex - 1
  const isModelSelected = form.modelId || form.modelUrl

  const carouselItems: CarouselItem[] = [
    ...models.map(m => ({ type: 'model' as const, data: m })),
    { type: 'custom' as const, data: null },
  ]

  return (
    <Fragment>
      {/* NOMBRE DE CÁPSULA */}
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8750rem', fontWeight: 500 }}>
          {txt('Nombre de Cápsula', 'Capsule Name')}
        </label>
        <input
          type="text"
          placeholder={txt('Viaje a Lanzarote', 'Trip to Lanzarote')}
          value={form.title}
          onChange={handleTitleChange}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '12px 20px',
            border: '1px solid var(--color-borde)',
            borderRadius: '8px',
            fontSize: '1rem',
            backgroundColor: 'var(--color-fondo-principal)',
            color: 'var(--color-texto-principal)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* DISEÑO DE CÁPSULA */}
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.8750rem', fontWeight: 500 }}>
          {txt('Diseño de Cápsula', 'Capsule Design')}
        </label>

        {/* Carousel outer wrapper */}
        <div style={{ position: 'relative', height: '190px', marginBottom: '12px' }}>

          {/* Drag + overflow-clip area */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'pan-y',
            }}
            onPointerDown={onCarouselPointerDown}
            onPointerMove={onCarouselPointerMove}
            onPointerUp={onCarouselPointerUp}
            onPointerLeave={onCarouselPointerUp}
            onClickCapture={onCarouselClickCapture}
          >
            {/* Sliding track: left edge starts at container center, then we translate left */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                display: 'flex',
                gap: `${ITEM_GAP}px`,
                alignItems: 'center',
                transform: `translateX(${-(carouselIndex * ITEM_SPAN + ITEM_WIDTH / 2) + dragOffset}px) translateY(-50%)`,
                transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                userSelect: 'none',
                willChange: 'transform',
              }}
            >
              {carouselItems.map((item, i) => {
                const distPx = (i - carouselIndex) * ITEM_SPAN + dragOffset
                const dist = Math.abs(distPx / ITEM_SPAN)
                const opacity = Math.max(0, 1 - dist * 0.6)
                const scale = Math.max(0.78, 1 - dist * 0.18)
                const isCenter = i === carouselIndex

                return (
                  <div
                    key={item.type === 'model' ? item.data!.id : 'custom'}
                    style={{
                      width: `${ITEM_WIDTH}px`,
                      height: `${ITEM_WIDTH}px`,
                      flexShrink: 0,
                      opacity,
                      transform: `scale(${scale})`,
                      transition: isDragging
                        ? 'opacity 0.05s, transform 0.05s'
                        : 'opacity 0.35s, transform 0.35s',
                      cursor: isCenter
                        ? item.type === 'custom' ? 'pointer' : 'default'
                        : 'pointer',
                    }}
                    onPointerDown={isCenter && item.type === 'custom' ? e => e.stopPropagation() : undefined}
                    onClick={() => {
                      if (i !== carouselIndex) {
                        setCarouselIndex(i)
                      } else if (item.type === 'custom') {
                        handleCustomModelClick()
                      }
                    }}
                  >
                    {item.type === 'model' ? (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          outline: isCenter ? '2.5px solid #bbb' : 'none',
                          outlineOffset: '3px',
                        }}
                      >
                        <img
                          src={item.data!.thumbnailUrl}
                          alt={item.data!.nombre}
                          draggable={false}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', display: 'block' }}
                        />
                      </div>
                    ) : uploadingFile ? (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          background: 'var(--color-fondo-secundario)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          outline: isCenter ? '2.5px solid #bbb' : 'none',
                          outlineOffset: '3px',
                        }}
                      >
                        <span className="capsula-thumb-spinner" />
                      </div>
                    ) : form.modelUrl && !form.modelId ? (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          outline: isCenter ? '2.5px solid #bbb' : 'none',
                          outlineOffset: '3px',
                        }}
                      >
                        <img
                          src={form.thumbnailUrl}
                          alt="Modelo personalizado"
                          draggable={false}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          background: 'transparent',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          border: '1.5px dashed var(--color-borde)',
                          outline: isCenter ? '2.5px solid #bbb' : 'none',
                          outlineOffset: '3px',
                        }}
                      >
                        <span style={{ fontSize: '3rem', lineHeight: 1 }}>+</span>
                        <span style={{ fontSize: '0.6875rem', textAlign: 'center', color: 'var(--color-texto-secundario)', padding: '0 8px' }}>
                          {txt('Cápsula personalizada', 'Custom capsule')}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Left arrow — stopPropagation on pointerDown so it doesn't start a drag */}
          <button
            type="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={() => setCarouselIndex(prevIndex)}
            disabled={isLoading}
            aria-label={txt('Modelo anterior', 'Previous model')}
            style={{
              position: 'absolute',
              left: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
              background: 'none',
              border: 'none',
              fontSize: '1.75rem',
              lineHeight: 1,
              color: 'var(--color-texto-principal)',
              opacity: 0.65,
              cursor: 'pointer',
              padding: '8px 6px',
            }}
          >
            ‹
          </button>

          {/* Right arrow */}
          <button
            type="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={() => setCarouselIndex(nextIndex)}
            disabled={isLoading}
            aria-label={txt('Modelo siguiente', 'Next model')}
            style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
              background: 'none',
              border: 'none',
              fontSize: '1.75rem',
              lineHeight: 1,
              color: 'var(--color-texto-principal)',
              opacity: 0.65,
              cursor: 'pointer',
              padding: '8px 6px',
            }}
          >
            ›
          </button>
        </div>

        {/* Dot indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
          {Array.from({ length: totalItems }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCarouselIndex(i)}
              disabled={isLoading}
              aria-label={`${i + 1}`}
              style={{
                width: i === carouselIndex ? '16px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === carouselIndex ? '#bbb' : 'var(--color-borde)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'width 0.3s ease, background 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Hidden file input for custom 3D model */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf"
          onChange={handleModelFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* SUBIR ARCHIVOS */}
      <div
        style={{
          border: '1px solid var(--color-borde)',
          borderRadius: '12px',
          padding: '16px',
          margin: '0 20px',
          marginBottom: '24px',
        }}
      >
        <label style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--color-texto-principal)', display: 'block', marginBottom: '12px' }}>
          {txt('Subir archivos', 'Upload files')}
        </label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          {form.mediaFiles.map((file, index) => {
            const isVideo = file.type.startsWith('video')
            const isImage = file.type.startsWith('image')
            const preview = isImage || isVideo ? URL.createObjectURL(file) : null

            return (
              <div key={index} style={{ position: 'relative', width: '112px', height: '112px' }}>
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '10px',
                    background: preview ? `url(${preview}) center/cover` : 'var(--color-fondo-secundario)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                  }}
                >
                  {isVideo && (
                    <div style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(0, 0, 0, 0.7)', color: 'white', padding: '2px 6px', fontSize: '0.6250rem', borderRadius: '3px' }}>
                      VID
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(index)}
                    aria-label={txt('Eliminar archivo', 'Remove file')}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#8B2020',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={handleAddMedia}
            disabled={isLoading}
            style={{
              width: '112px',
              height: '112px',
              borderRadius: '10px',
              background: 'var(--color-fondo-secundario)',
              border: '2px dashed var(--color-borde)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              color: 'var(--color-texto-principal)',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p style={{ color: '#8B2020', fontSize: '0.8750rem', padding: '0 20px', marginBottom: '16px' }}>
          {error}
        </p>
      )}

      {/* BOTÓN CONTINUAR */}
      <div style={{ padding: '0 20px', marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleContinue}
          disabled={isLoading || loadingModels || uploadingFile || !form.title.trim() || !isModelSelected}
          style={{
            padding: '12px 32px',
            backgroundColor: isLoading || loadingModels || uploadingFile || !form.title.trim() || !isModelSelected
              ? 'var(--color-borde)'
              : 'var(--color-boton-primario)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isLoading || loadingModels || uploadingFile || !form.title.trim() || !isModelSelected ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 500,
          }}
        >
          {uploadingFile ? txt('Subiendo...', 'Uploading...') : txt('Continuar', 'Continue')}
        </button>
      </div>
    </Fragment>
  )
}

export default CreateCapsuleStep1
