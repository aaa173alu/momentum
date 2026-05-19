import { Fragment, type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset } from '../img'
import { API_BASE_URL, createCapsule, uploadMediaFile } from '../services/api.ts'
import { render3DThumbnailFromUrl } from '../utils/render3DThumb'

function is3DMedia(type: string | undefined, fileName: string) {
  if (type === '3d') return true
  return /\.(glb|gltf)$/i.test(fileName)
}

function resolveApiAssetUrl(url: string) {
  if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url
  const base = API_BASE_URL
  if (!base) return url
  return `${base}${url.startsWith('/') ? url : `/${url}`}`
}


function UploadCapsule() {
  const navigate = useNavigate()
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const token = localStorage.getItem('authToken')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [designKey, setDesignKey] = useState('default')
  const [designLabel, setDesignLabel] = useState('Simple')
  const [timeCapsuleEnabled, setTimeCapsuleEnabled] = useState(false)
  const [unlockAt, setUnlockAt] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [previews, setPreviews] = useState<Array<{ file: File; url: string; kind: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [navigate, token])

  useEffect(() => {
    if (!files) {
      setPreviews([])
      return
    }

    let cancelled = false
    const toRevoke: string[] = []

    const buildPreviews = async () => {
      const list = Array.from(files)

      const items = list.map((file) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        let kind = 'file'
        if (file.type.startsWith('image/')) kind = 'image'
        else if (file.type.startsWith('video/')) kind = 'video'
        else if (file.type.startsWith('audio/')) kind = 'audio'
        else if (/^(glb|gltf|obj|fbx|stl)$/i.test(ext)) kind = '3d-loading'
        else if (/^(mp4|webm|mov|mkv|ogv|ogg)$/i.test(ext)) kind = 'video'
        else if (/^(mp3|wav|m4a|aac|ogg)$/i.test(ext)) kind = 'audio'
        else if (/^(png|jpg|jpeg|gif|webp)$/i.test(ext)) kind = 'image'
        const url = URL.createObjectURL(file)
        toRevoke.push(url)
        return { file, url, kind }
      })

      setPreviews((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.url)); return items })

      // Generate rendered thumbnail for each 3D file
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind !== '3d-loading' || cancelled) continue
        try {
          const thumbBlob = await render3DThumbnailFromUrl(items[i].url)
          if (cancelled) break
          const thumbUrl = URL.createObjectURL(thumbBlob)
          toRevoke.push(thumbUrl)
          setPreviews((prev) => prev.map((p, idx) => idx === i ? { ...p, url: thumbUrl, kind: '3d' } : p))
        } catch {
          if (!cancelled) setPreviews((prev) => prev.map((p, idx) => idx === i ? { ...p, kind: '3d-error' } : p))
        }
      }
    }

    buildPreviews()
    return () => { cancelled = true; toRevoke.forEach((u) => URL.revokeObjectURL(u)) }
  }, [files])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!title.trim()) {
      setError('El titulo es obligatorio')
      return
    }

    if (timeCapsuleEnabled && !unlockAt) {
      setError('Indica la fecha de desbloqueo')
      return
    }

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const uploadedMedia = files
        ? await Promise.all(
          Array.from(files).map(async (file) => {
            const upload = await uploadMediaFile(file)

            let thumbnailUrl = upload.thumbnailUrl ?? ''
            if (is3DMedia(upload.type, upload.originalName)) {
              try {
                const modelAbsoluteUrl = resolveApiAssetUrl(upload.fileUrl)
                const thumbBlob = await render3DThumbnailFromUrl(modelAbsoluteUrl)
                const thumbFile = new File([thumbBlob], `${upload.originalName.replace(/\.[^.]+$/, '')}-thumb.png`, {
                  type: 'image/png',
                })
                const thumbUpload = await uploadMediaFile(thumbFile)
                thumbnailUrl = thumbUpload.fileUrl
              } catch {
                thumbnailUrl = ''
              }
            }

            return {
              type: upload.type,
              url: upload.fileUrl,
              modelFormat: upload.modelFormat ?? '',
              fileSize: upload.size,
              title: upload.originalName,
              description: '',
              thumbnailUrl,
            }
          }),
        )
        : []

      const createdCapsule = await createCapsule({
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
        design: {
          key: designKey,
          label: designLabel,
        },
        timeCapsule: {
          enabled: timeCapsuleEnabled,
          unlockAt: timeCapsuleEnabled ? unlockAt : null,
        },
        mediaItems: uploadedMedia,
      })

      setSuccess('Capsula creada correctamente')
      navigate('/capsula', { state: { capsuleId: createdCapsule._id } })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'No se pudo crear la capsula'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Fragment>
      <header className="mobile-header" aria-label="Subir capsula">
        <button type="button" className="mobile-header__left" onClick={() => navigate(-1)} aria-label="Volver atras">←</button>
        <Link to="/inicio" className="logo-button" aria-label="Ir a inicio">
          <img src={logo} alt="Momentum" />
        </Link>
        <span className="mobile-header__right" aria-hidden="true" />
      </header>
      <section className="page-card form-card">
      <div>
        <h1>Subir capsula</h1>
        <p>Crea un nuevo recuerdo con datos reales y sube los archivos al backend.</p>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Titulo</span>
          <input
            type="text"
            placeholder="Ejemplo: Mi concierto favorito"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Categoria</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Selecciona una categoria</option>
            <option value="familia">Familia</option>
            <option value="viajes">Viajes</option>
            <option value="amistad">Amistad</option>
            <option value="trabajo">Trabajo</option>
            <option value="otros">Otros</option>
          </select>
        </label>

        <label className="field">
          <span>Descripcion</span>
          <textarea
            placeholder="Describe el momento que quieres guardar"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className="panel upload-settings">
          <label className="field">
            <span>Diseño</span>
            <input
              type="text"
              value={designLabel}
              onChange={(event) => setDesignLabel(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Clave de diseño</span>
            <input
              type="text"
              value={designKey}
              onChange={(event) => setDesignKey(event.target.value)}
            />
          </label>

          <label className="field checkbox-field">
            <span>Capsula con desbloqueo futuro</span>
            <input
              type="checkbox"
              checked={timeCapsuleEnabled}
              onChange={(event) => setTimeCapsuleEnabled(event.target.checked)}
            />
          </label>

          {timeCapsuleEnabled ? (
            <label className="field">
              <span>Fecha de desbloqueo</span>
              <input
                type="datetime-local"
                value={unlockAt}
                onChange={(event) => setUnlockAt(event.target.value)}
              />
            </label>
          ) : null}
        </div>

        <label className="field">
          <span>Archivos</span>
          <input
            type="file"
            multiple
            onChange={(event) => setFiles(event.target.files)}
          />
        </label>

        {previews.length > 0 ? (
          <div className="upload-previews">
            {previews.map((p, idx) => (
              <div key={`${p.file.name}-${idx}`} className="upload-preview-item">
                {p.kind === 'image' ? (
                  // image preview
                  // eslint-disable-next-line jsx-a11y/img-redundant-alt
                  <img src={p.url} alt={`Preview ${p.file.name}`} className="upload-preview-image" />
                ) : p.kind === 'video' ? (
                  <video src={p.url} controls className="upload-preview-video" />
                ) : p.kind === 'audio' ? (
                  <audio src={p.url} controls className="upload-preview-audio" />
                ) : p.kind === '3d' ? (
                  <div className="upload-preview-3d">
                    <img src={p.url} alt={p.file.name} className="upload-preview-image" />
                    <div className="upload-preview-3d__name">{p.file.name}</div>
                  </div>
                ) : p.kind === '3d-loading' ? (
                  <div className="upload-preview-3d">
                    <div className="upload-preview-3d__thumb"><span className="capsula-thumb-spinner" /></div>
                    <div className="upload-preview-3d__name">{p.file.name}</div>
                  </div>
                ) : p.kind === '3d-error' ? (
                  <div className="upload-preview-3d">
                    <div className="upload-preview-3d__thumb">3D</div>
                    <div className="upload-preview-3d__name">{p.file.name}</div>
                  </div>
                ) : (
                  <a href={p.url} target="_blank" rel="noreferrer" className="upload-preview-file">{p.file.name}</a>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {error ? <p className="page-status page-status--error">{error}</p> : null}
        {success ? <p className="page-status page-status--success">{success}</p> : null}

        <div className="button-row">
          <button type="submit" className="button-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar capsula'}
          </button>
          <button type="button" className="button-secondary" onClick={() => navigate('/inicio')}>
            Cancelar
          </button>
        </div>
      </form>
      </section>
    </Fragment>
  )
}

export default UploadCapsule