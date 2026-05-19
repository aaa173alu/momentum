import { useEffect, useState, Fragment, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset, deleteIconNAsset } from '../img'
import iconDelete from '../img/icon_delete.svg'
import iconCreate from '../img/icon_create.svg'
import { Model3DViewer } from '../3d/Model3DViewer'
import {
  API_BASE_URL,
  fetchCapsuleById,
  fetchFriends,
  APP_PUBLIC_URL,
  type ApiCapsule,
  type ApiUser,
  type ApiFriendRelation,
} from '../services/api'
import { useTranslate } from '../services/useTranslate'
import '../styles/capsule-edit.css'
const SLIDE_GAP = 0

function resolveUrl(url: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('//') || url.startsWith('data:') || url.startsWith('blob:')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`
}

// getFileName and getMediaKind are implemented inside the component to ensure
// they use the current component context and avoid duplicate definitions.

function getDisplayAvatar(user: any) {
  if (!user || typeof user === 'string') return ''
  return user.avatar || user.profilePhoto || user.photo || user.image || user.avatarUrl || ''
}

function getPrimaryDisplayUser(users: any[]) {
  return users.find((user) => getDisplayAvatar(user)) ?? users[0] ?? null
}

function AvatarStack({ users, max = 4, size = 26 }: { users: any[]; max?: number; size?: number }) {
  if (!users.length) return null
  const visible = users.slice(0, max)
  return (
    <div className="ce-avatar-stack" aria-hidden="true">
      {visible.map((u, i) => {
        const name = typeof u === 'string' ? u : (u?.name || u?.username || '?')
        const avatar = getDisplayAvatar(u)
        return (
          <div key={i} className="ce-avatar-stack__item" style={{ width: size, height: size, zIndex: max - i }}>
            {avatar
              ? <img src={resolveUrl(avatar)} alt={name} onError={(e:any) => {
                  try {
                    const initial = (name || '?').charAt(0).toUpperCase();
                    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23d5ccc0'/><text x='50' y='66' font-size='50' text-anchor='middle' fill='%23666' font-family='Arial, sans-serif'>${initial}</text></svg>`;
                    e.currentTarget.onerror = null
                    e.currentTarget.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
                  } catch { e.currentTarget.style.display = 'none' }
                }} />
              : <span>{name.charAt(0).toUpperCase()}</span>}
          </div>
        )
      })}
    </div>
  )
}

function CapsuleEditPage() {
  const { capsuleId: id } = useParams<{ capsuleId: string }>()
  const navigate = useNavigate()
  const { tema } = useTema()
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const deleteIcon = tema === 'oscuro' ? iconDelete : deleteIconNAsset
  const fileInputRef = useRef<HTMLInputElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  const [capsule, setCapsule] = useState<ApiCapsule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<Array<{ id: string; file: File; preview?: string }>>([])
  const [friends, setFriends] = useState<ApiUser[]>([])
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  
  const [slideWidth, setSlideWidth] = useState(0)
  const [canManage, setCanManage] = useState(false)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)

  // Match CapsuleInterior: exclude 3d media from main carousel
  const mediaItems = (capsule?.mediaItems || []).filter((m) => getMediaKind(m) !== '3d')
  const totalSlides = mediaItems.length + pendingFiles.length

  function getFileName(url: string, fallback = 'Archivo') {
    try {
      const cleanUrl = String(url).split('?')[0].split('#')[0]
      const name = decodeURIComponent(cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1))
      return name || fallback
    } catch {
      return fallback
    }
  }

  function getMediaKind(media: any): 'image' | 'video' | 'audio' | '3d' | 'pdf' | 'text' | 'file' {
    const url = String(media?.url || '')
    const mimeType = String(media?.mimeType || '')
    const title = String(media?.title || '')
    const type = media?.type
    if (mimeType) {
      if (mimeType.startsWith('image/')) return 'image'
      if (mimeType.startsWith('video/')) return 'video'
      if (mimeType.startsWith('model/') || mimeType.includes('gltf')) return '3d'
    }
    if (type === '3d') return '3d'
    if (type === 'audio') return 'audio'
    if (type === 'video') return 'video'
    if (type === 'image') return 'image'
    if (title) {
      const t = title.toLowerCase()
      if (/\.(glb|gltf|obj|fbx|stl)$/i.test(t)) return '3d'
      if (/\.(mp4|mov|webm|ogg|avi|mkv)$/i.test(t)) return 'video'
      if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(t)) return 'image'
    }
    const urlLower = url.toLowerCase()
    if (/\.(glb|gltf|obj|fbx|stl)(\?.*)?$/i.test(urlLower)) return '3d'
    if (/\.(mp4|mov|webm|ogg|avi|mkv)(\?.*)?$/i.test(urlLower)) return 'video'
    if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(urlLower)) return 'image'
    return 'file'
  }

  function getMediaAuthor(media: any) {
    const author = media?.author
    if (author && typeof author === 'object') return author
    return null
  }

  function getUserAvatar(user: any) {
    return user?.avatar || user?.profilePhoto || ''
  }

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    const measure = () => setSlideWidth(el.offsetWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading])

  useEffect(() => {
    if (!id) { setError(txt('ID de capsula no encontrado', 'Capsule ID not found')); setLoading(false); return }
    const token = sessionStorage.getItem('authToken')
    if (!token) { navigate('/login', { replace: true }); return }
    let active = true

    const load = async () => {
      try {
        const [data, friendsData] = await Promise.all([
          fetchCapsuleById(id),
          fetchFriends().catch(() => [] as ApiFriendRelation[]),
        ])

        const authUser = sessionStorage.getItem('authUser')
        if (!authUser) throw new Error('No auth user')
        const user = JSON.parse(authUser)
        const userId = user._id

        const ownerId = typeof data.owner === 'string' ? data.owner : data.owner?._id
        const isOwner = userId === ownerId
        const isAdmin = data.collaborators?.some((c: any) =>
          (typeof c.user === 'string' ? c.user : c.user._id) === userId && c.role === 'admin'
        ) ?? false
        const isEditor = data.collaborators?.some((c: any) =>
          (typeof c.user === 'string' ? c.user : c.user._id) === userId && c.role === 'edit'
        ) ?? false

        if (!isOwner && !isAdmin && !isEditor) {
          throw new Error(txt('No tienes permiso para editar esta capsula', 'You do not have permission to edit this capsule'))
        }

        const alreadySharedIds = new Set([
          ...(data.sharedWith ?? []).map((u: any) => typeof u === 'string' ? u : u._id),
          ...(data.collaborators ?? []).map((c: any) => typeof c.user === 'string' ? c.user : c.user._id),
          ownerId,
        ])

        const friendUsers: ApiUser[] = friendsData
          .filter((r) => r.status === 'accepted')
          .map((r) => {
            const u = r.otherUser ?? r.friend ?? (
              typeof r.requester === 'object' && (r.requester as ApiUser)._id !== userId
                ? r.requester as ApiUser
                : typeof r.recipient === 'object' ? r.recipient as ApiUser : null
            )
            return u as ApiUser
          })
          .filter(Boolean)
          .filter((u) => !alreadySharedIds.has(u._id))

        if (active) {
          setCapsule(data)
          setCanManage(isOwner || isAdmin)
          setFriends(friendUsers)
          setLoading(false)
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : txt('No se pudo cargar la capsula', 'Could not load capsule'))
          setLoading(false)
        }
      }
    }

    load()
    return () => { active = false }
  }, [id, navigate, language])

  const patchCapsule = useCallback(async (body: Record<string, unknown>) => {
    if (!id) return
    const token = sessionStorage.getItem('authToken')
    await fetch(`${API_BASE}/api/capsules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  }, [id])

  const handleSaveTitle = async () => {
    if (!capsule) return
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === capsule.title) { setEditingTitle(false); return }
    setSavingTitle(true)
    try {
      await patchCapsule({ title: trimmed })
      setCapsule({ ...capsule, title: trimmed })
    } finally {
      setSavingTitle(false)
      setEditingTitle(false)
    }
  }

  const handleDescriptionBlur = async (value: string) => {
    if (!capsule || value === (capsule.description ?? '')) return
    setCapsule({ ...capsule, description: value })
    await patchCapsule({ description: value })
  }

  const handleDeleteMedia = async (mediaId: string) => {
    if (!id) return
    const token = sessionStorage.getItem('authToken')
    try {
      const res = await fetch(`${API_BASE}/api/capsules/${id}/media/${mediaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
        if (res.ok) {
        const updated = await fetchCapsuleById(id)
        setCapsule(updated)
        const newCount = (updated.mediaItems ?? []).filter(
          (m) => m.type === 'image' || m.type === 'video'
        ).length
        setActiveSlideIndex((prev) => Math.min(prev, Math.max(0, newCount - 1)))
      }
    } catch (err) {
      console.error('Error deleting media:', err)
    }
  }

  const handleDeleteCapsule = async () => {
    if (!capsule || !id) return
    try {
      const token = sessionStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}/api/capsules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (res.ok) {
        navigate('/mis-capsulas', { replace: true })
      } else {
        setError(txt('No se pudo eliminar la capsula', 'Could not delete capsule'))
      }
    } catch {
      setError(txt('Error al eliminar', 'Delete error'))
    } finally {
      setShowDeleteModal(false)
    }
  }

  const handleAddMedia = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const idStr = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const preview = URL.createObjectURL(file)
      setPendingFiles((p) => [...p, { id: idStr, file, preview }])
      if (fileInputRef.current) fileInputRef.current.value = ''
      setActiveSlideIndex(mediaItems.length + pendingFiles.length)
    } catch (err) {
      console.error('Error staging media:', err)
    }
  }

  const removePendingFile = (pendingId: string) => {
    setPendingFiles((p) => {
      const toRemove = p.find((x) => x.id === pendingId)
      if (toRemove && toRemove.preview) URL.revokeObjectURL(toRemove.preview)
      return p.filter((x) => x.id !== pendingId)
    })
    setActiveSlideIndex((i) => Math.max(0, Math.min(i, (mediaItems.length + pendingFiles.length - 2))))
  }

  const handleAddFriend = async (friendId: string) => {
    if (!id) return
    try {
      const token = sessionStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}/api/capsules/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userIds: [friendId] }),
      })
      if (res.ok) {
        const updated = await fetchCapsuleById(id)
        setCapsule(updated)
        setFriends((prev) => prev.filter((f) => f._id !== friendId))
        setShowAddFriend(false)
      }
    } catch (err) {
      console.error('Error adding friend:', err)
    }
  }

  const handleSave = async () => {
    const desc = descriptionRef.current?.value ?? ''
    try {
      if (pendingFiles.length > 0 && id) {
        setUploadingMedia(true)
        const token = sessionStorage.getItem('authToken')
        for (const p of pendingFiles) {
          try {
            const formData = new FormData()
            formData.append('file', p.file)
            const uploadRes = await fetch(`${API_BASE}/api/uploads/media`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData,
            })
            if (!uploadRes.ok) { console.error('Upload failed for', p.file.name); continue }
            const uploaded = await uploadRes.json()
            await fetch(`${API_BASE}/api/capsules/${id}/media`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ url: uploaded.fileUrl || uploaded.file || uploaded.url, type: uploaded.type, modelFormat: uploaded.modelFormat, thumbnailUrl: uploaded.thumbnailUrl }),
            })
          } catch (err) {
            console.error('Error uploading pending file:', err)
          }
        }
        // clear pending previews
        pendingFiles.forEach((p) => p.preview && URL.revokeObjectURL(p.preview))
        setPendingFiles([])
        // refresh capsule after uploads
        if (id) {
          const updated = await fetchCapsuleById(id)
          setCapsule(updated)
        }
      }

      if (capsule && desc !== (capsule.description ?? '')) {
        await patchCapsule({ description: desc })
      }
    } catch (err) {
      console.error('Error saving capsule:', err)
    } finally {
      setUploadingMedia(false)
    }

    navigate(-1)
  }

  const translateX = slideWidth > 0
  ? `${activeSlideIndex * -(slideWidth + SLIDE_GAP)}px`
  : `calc(${activeSlideIndex} * -1 * 100%)`

  const header = (
    <header className="mobile-header" aria-label={txt('Editar capsula', 'Edit capsule')}>
      <button type="button" className="mobile-header__left" onClick={() => navigate(-1)} aria-label={txt('Volver', 'Back')}>←</button>
      <Link to="/inicio" className="logo-button" aria-label={txt('Ir a inicio', 'Go home')}>
        <img src={logo} alt="Momentum" />
      </Link>
      <span className="mobile-header__right" aria-hidden="true" />
    </header>
  )

  if (loading) return (
    <Fragment>
      {header}
      <section className="page-layout"><p>{txt('Cargando...', 'Loading...')}</p></section>
    </Fragment>
  )

  if (error || !capsule) return (
    <Fragment>
      {header}
      <section className="page-layout"><p>{error || txt('No se pudo cargar la capsula', 'Could not load capsule')}</p></section>
    </Fragment>
  )

  const collaborators = [
    ...(capsule.sharedWith ?? []),
    ...(capsule.collaborators ?? []).map((c: any) =>
      typeof c.user === 'string' ? { _id: c.user } : c.user
    ),
  ]
  const primaryCollaborator = getPrimaryDisplayUser(collaborators)

  // Find 3D model for top viewer (reuse view styling)
  const model3D = (capsule?.mediaItems || []).find((m: any) => m.type === '3d') ?? null
  const modelPath = model3D ? resolveUrl(model3D.url) : '/3d/liberty.glb'

  return (
    <Fragment>
      {header}

      <section className="ce-page">
        {/* Top preview similar to CapsuleView */}
        <div className="capsule-view__title-row" style={{ width: '100%' }}>
          <h1 className="capsule-view__title">{capsule.title}</h1>
          <AvatarStack users={primaryCollaborator ? [primaryCollaborator] : collaborators} size={28} max={1} />
        </div>

        <div className="capsule-view__model-wrapper" style={{ width: '100%', marginTop: 8 }}>
          <Model3DViewer modelPath={modelPath} backgroundColor="transparent" />
        </div>
        {/* Header row */}
        <div className="ce-header">
          <div className="ce-header__left">
            {editingTitle ? (
              <div className="ce-title-edit">
                <input
                  className="ce-title-edit__input"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleSaveTitle() }
                    if (e.key === 'Escape') setEditingTitle(false)
                  }}
                  autoFocus
                  disabled={savingTitle}
                />
                <button
                  type="button"
                  className="ce-title-edit__cancel"
                  onMouseDown={(e) => { e.preventDefault(); setEditingTitle(false) }}
                  aria-label={txt('Cancelar edicion', 'Cancel editing')}
                >×</button>
              </div>
            ) : (
              <button
                type="button"
                className="ce-title__btn"
                onClick={() => { setTitleDraft(capsule.title || ''); setEditingTitle(true) }}
              >
                <span className="ce-title__text">{capsule.title}</span>
                <span className="ce-title__pencil" aria-hidden="true">✎</span>
              </button>
            )}
            <AvatarStack users={primaryCollaborator ? [primaryCollaborator] : collaborators} size={26} max={1} />
          </div>

          <button type="button" className="ce-header__cancel" onClick={() => navigate(-1)}>
            {txt('Cancelar', 'Cancel')}
          </button>
        </div>

        {/* Add friend — owner/admin only */}
        {canManage && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="ce-add-friend-btn" onClick={() => setShowAddFriend(true)}>
                + {txt('anadir amigo', 'add friend')}
              </button>
              <button type="button" className="ce-add-friend-btn" onClick={async () => {
                if (!id) return
                try {
                  const token = sessionStorage.getItem('authToken')
                  const res = await fetch(`${API_BASE}/api/capsules/${id}/invite`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ role: 'view', expiresInDays: 14 }),
                  })
                  if (!res.ok) throw new Error('Invite generation failed')
                  const data = await res.json()
                  const url = data.url || `${APP_PUBLIC_URL}/invite/${data.token}`
                  await navigator.clipboard.writeText(url)
                  alert(txt('Enlace de invitacion copiado al portapapeles', 'Invite link copied to clipboard'))
                } catch (e) {
                  console.error('Error generating invite:', e)
                  alert(txt('No se pudo generar el enlace', 'Could not generate invite'))
                }
              }}>
                {txt('Generar enlace', 'Generate link')}
              </button>
            </div>
        )}

        {/* Carousel */}
        {mediaItems.length > 0 ? (
          <div className="ci-carousel-wrap">
            <div className="ci-carousel-outer" ref={carouselRef}>
              <div
                className="ci-carousel-track"
                style={{ transform: `translateX(${translateX})` }}
              >
                {mediaItems.map((media, idx) => {
                  const author = getMediaAuthor(media)
                  const fallbackOwner = typeof capsule?.owner === 'object' ? capsule?.owner : null
                  const effectiveAuthor = author || fallbackOwner
                  const avatar = getUserAvatar(effectiveAuthor)
                  const kind = getMediaKind(media)
                  const fileName = media.title?.trim() || getFileName(media.url)
                  return (
                  <div
                    key={media._id || idx}
                    className="ci-slide"
                    style={slideWidth > 0 ? { width: `${slideWidth}px` } : undefined}
                  >
                    <div className="ci-slide__author" aria-label={`Subido por`}>
                      {avatar
                        ? <img src={resolveUrl(avatar)} alt={effectiveAuthor?.name || ''} />
                        : <span>{(effectiveAuthor?.name || 'U').charAt(0).toUpperCase()}</span>}
                    </div>

                    {kind === 'image' ? (
                      <img
                        className="ci-slide__media"
                        src={resolveUrl(media.url)}
                        alt={media.title || getFileName(media.url)}
                        style={{ display: 'block', objectFit: 'contain' }}
                        onClick={() => navigate(`/capsulas/${capsule?._id}/media/${idx}`)}
                        role="button"
                        tabIndex={0}
                      />
                    ) : kind === 'video' ? (
                      <video
                        className="ci-slide__media"
                        src={resolveUrl(media.url)}
                        controls
                      />
                    ) : kind === 'audio' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 20, flexDirection: 'column', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => window.open(resolveUrl(media.url), '_blank', 'noopener,noreferrer')}
                          style={{ border: 'none', background: 'transparent', color: 'var(--color-texto-principal)', cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}
                        >
                          {fileName}
                        </button>
                        <audio src={resolveUrl(media.url)} controls style={{ width: '90%' }} />
                      </div>
                    ) : kind === 'pdf' ? (
                      <button
                        type="button"
                        onClick={() => window.open(resolveUrl(media.url), '_blank', 'noopener,noreferrer')}
                        style={{ width: '100%', height: '100%', border: 'none', background: '#f6f1e8', cursor: 'pointer', padding: 20 }}
                        aria-label={txt('Abrir PDF', 'Open PDF')}
                      >
                        <object
                          data={resolveUrl(media.url)}
                          type="application/pdf"
                          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
                            <span>{fileName}</span>
                            <small style={{ color: 'var(--color-texto-secundario)' }}>{txt('Toca para abrir el PDF', 'Tap to open PDF')}</small>
                          </div>
                        </object>
                      </button>
                    ) : kind === 'text' ? (
                      <button
                        type="button"
                        onClick={() => window.open(resolveUrl(media.url), '_blank', 'noopener,noreferrer')}
                        style={{ width: '100%', height: '100%', border: 'none', background: '#f6f1e8', cursor: 'pointer', padding: 20, textAlign: 'left' }}
                        aria-label={txt('Abrir archivo de texto', 'Open text file')}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', overflow: 'hidden' }}>
                          <span style={{ textDecoration: 'underline', color: 'var(--color-texto-principal)' }}>{fileName}</span>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--color-texto-secundario)', overflow: 'hidden' }}>{txt('Toca para abrir el archivo de texto', 'Tap to open text file')}</pre>
                        </div>
                      </button>
                    ) : kind === '3d' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 20 }}>
                        <span>{fileName}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => window.open(resolveUrl(media.url), '_blank', 'noopener,noreferrer')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', padding: 20, flexDirection: 'column', gap: 8, border: 'none', background: '#f6f1e8', cursor: 'pointer' }}
                      >
                        <span style={{ color: 'var(--color-texto-principal)', textDecoration: 'underline' }}>{media.originalName || media.fileName || media.title || fileName}</span>
                        <small style={{ color: 'var(--color-texto-secundario)' }}>{media.mimeType || media.type}</small>
                      </button>
                    )}
                    <button
                      type="button"
                      className="ce-slide__delete"
                      onClick={() => media._id && handleDeleteMedia(media._id)}
                      aria-label={txt('Eliminar foto', 'Delete photo')}
                    >
                      <img src={deleteIcon} alt="" width={16} height={16} aria-hidden="true" />
                    </button>
                  </div>
                  )
                })}

                {/* pending staged files (not uploaded yet) */}
                {pendingFiles.map((pending) => {
                  const file = pending.file
                  const t = (file.type || '').toLowerCase()
                  const kind = t.startsWith('image/') ? 'image' : t.startsWith('video/') ? 'video' : t.startsWith('audio/') ? 'audio' : (file.name && /\.(pdf)$/i.test(file.name)) ? 'pdf' : (file.name && /\.(txt|md|csv|log|json|xml|yaml|yml|ini|rtf)$/i.test(file.name)) ? 'text' : 'file'
                  const fileName = file.name || 'Archivo'
                  return (
                    <div key={pending.id} className="ci-slide" style={slideWidth > 0 ? { width: `${slideWidth}px` } : undefined}>
                      <div className="ci-slide__author" aria-label={`Pendiente`}> 
                        <span>P</span>
                      </div>
                      {kind === 'image' ? (
                        <img className="ci-slide__media" src={pending.preview} alt={fileName} style={{ display: 'block', objectFit: 'contain' }} />
                      ) : kind === 'video' ? (
                        <video className="ci-slide__media" src={pending.preview} controls />
                      ) : kind === 'audio' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 20, flexDirection: 'column', gap: 8 }}>
                          <span>{fileName}</span>
                          <audio src={pending.preview} controls style={{ width: '90%' }} />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', padding: 20 }}>
                          <span>{fileName}</span>
                        </div>
                      )}
                      <button type="button" className="ce-slide__delete" onClick={() => removePendingFile(pending.id)} aria-label={txt('Eliminar medio pendiente', 'Remove pending media')}>
                        ×
                      </button>
                    </div>
                  )
                })}

                {/* + add slide */}
                <div
                  className="ci-slide ci-slide--add"
                  style={slideWidth > 0 ? { width: `${slideWidth}px` } : undefined}
                >
                  <button
                    type="button"
                    className="ce-slide__add-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia}
                    aria-label={txt('Anadir foto', 'Add photo')}
                  >
                    {uploadingMedia
                      ? '…'
                      : <img src={iconCreate} alt="" width={22} height={22} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </div>

              <div className="ci-carousel-controls">
              <button
                type="button"
                className="ci-carousel__arrow"
                onClick={() => setActiveSlideIndex((i) => Math.max(0, i - 1))}
                disabled={activeSlideIndex === 0}
                aria-label={txt('Anterior', 'Previous')}
              >‹</button>
              <div className="ci-dots">
                {Array.from({ length: totalSlides }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`ci-dot${activeSlideIndex === i ? ' ci-dot--active' : ''}`}
                    onClick={() => setActiveSlideIndex(i)}
                    aria-label={`${txt('Ir a slide', 'Go to slide')} ${i + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                className="ci-carousel__arrow"
                onClick={() => setActiveSlideIndex((i) => Math.min(totalSlides - 1, i + 1))}
                disabled={activeSlideIndex >= totalSlides - 1}
                aria-label={txt('Siguiente', 'Next')}
              >›</button>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <button type="button" className="ce-add-media-btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia}>
                {uploadingMedia ? txt('Subiendo...', 'Uploading...') : `+ ${txt('Añadir multimedia', 'Add media')}`}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="ce-add-media-empty"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingMedia}
          >
            {uploadingMedia ? txt('Subiendo...', 'Uploading...') : `+ ${txt('Anadir fotos', 'Add photos')}`}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.glb,.gltf,.obj,.fbx,.stl"
          onChange={handleAddMedia}
          style={{ display: 'none' }}
          aria-hidden="true"
        />

        {/* Description */}
        <section className="ce-description">
          <h3 className="ce-description__label">{txt('Descripcion', 'Description')}</h3>
          <textarea
            ref={descriptionRef}
            className="ce-description__textarea"
            defaultValue={capsule.description || ''}
            onBlur={(e) => handleDescriptionBlur(e.target.value)}
            placeholder={txt('Escribe la descripcion de tu capsula...', 'Write your capsule description...')}
          />
        </section>

        {/* Guardar */}
        <button type="button" className="ce-save-btn" onClick={handleSave}>
          {txt('Guardar', 'Save')}
        </button>

        {/* Delete capsule — owner/admin only */}
        {canManage && (
          <button type="button" className="ce-delete-capsule-btn" onClick={() => setShowDeleteModal(true)}>
            {txt('Eliminar capsula', 'Delete capsule')}
          </button>
        )}
      </section>

      {/* Delete confirm modal */}
      {showDeleteModal && (
        <div className="ce-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="ce-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{txt('Confirmar eliminacion', 'Confirm deletion')}</h2>
            <p>{txt('Estas seguro de que deseas eliminar esta capsula? Esta accion no se puede deshacer.', 'Are you sure you want to delete this capsule? This action cannot be undone.')}</p>
            <div className="ce-modal__buttons">
              <button type="button" className="ce-modal__btn ce-modal__btn--cancel" onClick={() => setShowDeleteModal(false)}>
                {txt('Cancelar', 'Cancel')}
              </button>
              <button type="button" className="ce-modal__btn ce-modal__btn--delete" onClick={handleDeleteCapsule}>
                {txt('Eliminar', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add friend modal */}
      {showAddFriend && (
        <div className="ce-modal-overlay" onClick={() => setShowAddFriend(false)}>
          <div className="ce-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{txt('Anadir amigo', 'Add friend')}</h2>
            <p className="ce-modal__subtitle">{txt('Selecciona un amigo para compartir esta capsula', 'Select a friend to share this capsule')}</p>
            <div className="ce-friends-list">
              {friends.length > 0 ? friends.map((friend) => (
                <div key={friend._id} className="ce-friend-item">
                  <div className="ce-friend__info">
                    {friend.avatar
                      ? <img src={resolveUrl(friend.avatar)} alt={friend.name} className="ce-friend__avatar" />
                      : <div className="ce-friend__avatar ce-friend__avatar--fallback">{friend.name.charAt(0).toUpperCase()}</div>
                    }
                    <div className="ce-friend__text">
                      <strong>{friend.name}</strong>
                      <small>@{friend.username || friend.name}</small>
                    </div>
                  </div>
                  <button type="button" className="ce-friend__add-btn" onClick={() => handleAddFriend(friend._id)}>
                    {txt('Anadir', 'Add')}
                  </button>
                </div>
              )) : (
                <p className="ce-friends-empty">{txt('No tienes amigos disponibles para anadir', 'You have no friends available to add')}</p>
              )}
            </div>
            <button type="button" className="ce-modal__close-btn" onClick={() => setShowAddFriend(false)}>
              {txt('Cerrar', 'Close')}
            </button>
          </div>
        </div>
      )}
    </Fragment>
  )
}

export default CapsuleEditPage
