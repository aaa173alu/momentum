import { Fragment, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createCapsule, uploadMediaFile, type ApiMediaItem, fetchCurrentUser, type ApiUser } from '../services/api.ts'
import { render3DThumbnailFromUrl } from '../utils/render3DThumb'
import CreateCapsuleStep1 from '../components/CreateCapsuleStep1'
import CreateCapsuleStep2 from '../components/CreateCapsuleStep2'
import HeaderSimple from '../components/HeaderSimple'
import { useTranslate } from '../services/useTranslate'

function getModelFormatFromUrl(url: string) {
  return (url.split('?')[0].split('.').pop()?.toLowerCase() || '') as ApiMediaItem['modelFormat']
}

type CreateCapsuleCollaboratorPayload = NonNullable<Parameters<typeof createCapsule>[0]['collaborators']>[number]

export interface CreateCapsuleFormState {
  // Paso 1
  title: string
  modelId: string | null
  modelFile: File | null
  modelUrl?: string
  thumbnailUrl?: string
  mediaFiles: File[]

  // Paso 2
  descripcion: string
  categoria: string
  timeCapsule: {
    enabled: boolean
    type: 'partir_de' | 'despues_de'
    date: string | null
  }
  compartirConAmigos: boolean
  sharingDecision: 'pending' | 'friends' | 'link' | 'none'
  colaboradores: Array<{
    userId: string
    username: string
    avatar?: string
    rol: 'admin' | 'editar' | 'ver'
  }>
}

function CreateCapsuleFlowPage() {
  const navigate = useNavigate()
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const [paso, setPasoState] = useState(1)

  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null)
  const [form, setForm] = useState<CreateCapsuleFormState>({
    title: '',
    modelId: null,
    modelFile: null,
    thumbnailUrl: '',
    mediaFiles: [],
    descripcion: '',
    categoria: '',
    timeCapsule: {
      enabled: false,
      type: 'partir_de',
      date: null,
    },
    compartirConAmigos: false,
    sharingDecision: 'pending',
    colaboradores: [],
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await fetchCurrentUser()
        setCurrentUser(user)
      } catch (err) {
        console.error('Error loading user:', err)
      }
    }
    loadUser()
  }, [])

  const setPaso = (newPaso: number) => {
    setPasoState(newPaso)
  }

  async function handleCreateCapsule() {
    if (!form.title.trim()) {
      setError(txt('El título es obligatorio', 'Title is required'))
      return
    }

    if (!form.modelUrl && !form.modelId) {
      setError(txt('Debe seleccionar un diseño de cápsula', 'You must select a capsule design'))
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const mediaItems: ApiMediaItem[] = []

      // 1. Subir fotos y vídeos
      for (let i = 0; i < form.mediaFiles.length; i++) {
        const file = form.mediaFiles[i]
        const uploaded = await uploadMediaFile(file)
        mediaItems.push({
          type: uploaded.type as ApiMediaItem['type'],
          url: uploaded.fileUrl,
          modelFormat: undefined,
          fileSize: uploaded.size,
          title: file.name,
          description: '',
          thumbnailUrl: uploaded.thumbnailUrl ?? '',
        })
      }

      // 2. Guardar el modelo 3D — generar miniatura real antes de guardar
      let generatedThumbnailUrl = form.thumbnailUrl || ''
      if (form.modelUrl) {
        const modelTitle = form.modelId ? form.modelUrl : txt('Modelo 3D', '3D Model')
        try {
          const thumbBlob = await render3DThumbnailFromUrl(form.modelUrl)
          const thumbFile = new File([thumbBlob], 'model-thumb.png', { type: 'image/png' })
          const thumbUpload = await uploadMediaFile(thumbFile)
          generatedThumbnailUrl = thumbUpload.fileUrl
        } catch (err) {
          console.error('Could not generate 3D thumbnail, using placeholder', err)
        }
        mediaItems.push({
          type: '3d',
          url: form.modelUrl,
          modelFormat: getModelFormatFromUrl(form.modelUrl),
          title: modelTitle,
          description: '',
          thumbnailUrl: generatedThumbnailUrl,
        })
      }

      // 3. Crear cápsula
      const collaborators: CreateCapsuleCollaboratorPayload[] = form.colaboradores
        .filter(col => col.userId && String(col.userId).trim().length > 0)
        .map(col => ({
          userId: col.userId,
          role: col.rol === 'editar' ? 'edit' : col.rol === 'admin' ? 'admin' : 'view',
        }))

      // Debug: log payload to help diagnosing stuck creation
      try {
        // eslint-disable-next-line no-console
        console.log('Creating capsule payload', {
          title: form.title.trim(),
          category: form.categoria.trim(),
          description: form.descripcion.trim(),
          mediaItems,
          design: form.modelId ? { key: form.modelId } : undefined,
          previewImage: generatedThumbnailUrl,
          timeCapsule: form.timeCapsule.enabled ? {
            enabled: true,
            unlockAt: form.timeCapsule.date ? new Date(form.timeCapsule.date).toISOString() : null,
          } : undefined,
          collaborators,
        })
      } catch (logErr) {
        // ignore logging errors
      }

      const capsule = await createCapsule({
        title: form.title.trim(),
        category: form.categoria.trim(),
        description: form.descripcion.trim(),
        mediaItems,
        design: form.modelId ? { key: form.modelId } : undefined,
        previewImage: generatedThumbnailUrl,
        timeCapsule: form.timeCapsule.enabled
          ? {
              enabled: true,
              unlockAt: form.timeCapsule.date ? new Date(form.timeCapsule.date).toISOString() : null,
            }
          : undefined,
        collaborators: collaborators.length > 0 ? collaborators : undefined,
      })

      navigate(`/capsulas/${capsule._id}`)
    } catch (err) {
      // Log error for debugging
      // eslint-disable-next-line no-console
      console.error('Create capsule error:', err)
      setError(err instanceof Error ? err.message : txt('No se pudo crear la cápsula', 'Could not create capsule'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateForm = (updates: Partial<CreateCapsuleFormState>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }

  return (
    <Fragment>
      <HeaderSimple />

      <section className="page-card form-card">
        <h1 className="create-capsule__title" style={{ fontFamily: 'Playfair Display', fontSize: '1.3750rem', textAlign: 'center', marginBottom: '24px' }}>
          {txt('CREA TU CÁPSULA', 'CREATE YOUR CAPSULE')}
        </h1>

        {error && <p className="page-status page-status--error">{error}</p>}

        {paso === 1 && (
          <CreateCapsuleStep1
            form={form}
            updateForm={updateForm}
            onContinue={() => {
              setError('')
              setPaso(2)
            }}
            isLoading={isSubmitting}
          />
        )}

        {paso === 2 && currentUser && (
          <CreateCapsuleStep2
            form={form}
            updateForm={updateForm}
            onContinue={() => {
              handleCreateCapsule()
            }}
            onBack={() => setPaso(1)}
            currentUser={currentUser}
            isLoading={isSubmitting}
          />
        )}
      </section>
    </Fragment>
  )
}

export default CreateCapsuleFlowPage
