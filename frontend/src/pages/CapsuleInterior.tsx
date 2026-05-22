import { useEffect, useState, useRef, Fragment } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset } from '../img'
import iconEdit from '../img/icon_edit.svg'
import { API_BASE_URL, fetchCapsuleById, getCapsuleThumb, type ApiCapsule } from '../services/api'
import { formatUnlockDate, isTimeCapsuleLocked } from '../utils/timeCapsule'
import { useTranslate } from '../services/useTranslate'
import CapsulaThumb3D from '../components/CapsulaThumb3D'
import '../styles/capsule-interior.css'

function resolveUrl(url: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('//') || url.startsWith('data:') || url.startsWith('blob:')) return url
  if (url.startsWith('/3d/')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`
}

interface Comment {
  _id?: string
  author: { _id?: string; username?: string; name: string; avatar?: string } | string
  text: string
  replyTo?: string | null
  createdAt?: string
}

interface MediaAuthor {
  _id?: string
  username?: string
  name?: string
  avatar?: string
}

function getFileName(url: string, fallback = 'Archivo') {
  try {
    const cleanUrl = url.split('?')[0].split('#')[0]
    const name = decodeURIComponent(cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1))
    return name || fallback
  } catch {
    return fallback
  }
}

function getMediaAuthor(media: any): MediaAuthor | null {
  const author = media?.author
  if (author && typeof author === 'object') return author as MediaAuthor
  return null
}

function getUserAvatar(user: any) {
  return user?.avatar || user?.profilePhoto || ''
}

function getDisplayAvatar(user: any) {
  if (!user || typeof user === 'string') return ''
  return user.avatar || user.profilePhoto || user.photo || user.image || user.avatarUrl || ''
}

function getMediaKind(media: any) {
  const url = String(media?.url || '')
  const mimeType = String(media?.mimeType || '')
  const title = String(media?.title || '')
  const type = media?.type

  // Check MIME type first (most reliable)
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.startsWith('model/') || mimeType.includes('gltf')) return '3d'
    if (mimeType === 'application/pdf') return 'pdf'
    if (mimeType.startsWith('text/')) return 'text'
  }

  // Check explicit type field
  if (type === '3d') return '3d'
  if (type === 'audio') return 'audio'
  if (type === 'video') return 'video'
  if (type === 'image') return 'image'
  if (type === 'pdf') return 'pdf'
  if (type === 'text') return 'text'

  // Check title/filename for extension
  if (title) {
    const titleLower = title.toLowerCase()
    if (/\.(glb|gltf|obj|fbx|stl)$/i.test(titleLower)) return '3d'
    if (/\.(mp3|wav|ogg|oga|m4a|aac|flac|webm)$/i.test(titleLower)) return 'audio'
    if (/\.(mp4|mov|webm|ogg|avi|mkv)$/i.test(titleLower)) return 'video'
    if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(titleLower)) return 'image'
  }

  // Check URL for extension (fallback)
  const urlLower = url.toLowerCase()
  if (/\.(glb|gltf|obj|fbx|stl)(\?.*)?$/i.test(urlLower)) return '3d'
  if (/\.(mp3|wav|ogg|oga|m4a|aac|flac|webm)(\?.*)?$/i.test(urlLower)) return 'audio'
  if (/\.(mp4|mov|webm|ogg|avi|mkv)(\?.*)?$/i.test(urlLower)) return 'video'
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(urlLower)) return 'image'
  if (/\.(pdf)(\?.*)?$/i.test(urlLower)) return 'pdf'
  if (/\.(txt|md|csv|log|json|xml|yaml|yml|ini|rtf)(\?.*)?$/i.test(urlLower)) return 'text'

  return 'file'
}

function CommentRow({ comment }: { comment: Comment }) {
  const a = typeof comment.author === 'string' ? { name: comment.author } : comment.author
  const username = (a as any).username || (a as any).name || 'Usuario'
  const avatar = getUserAvatar(a)
  return (
    <div className="ci-comment">
      <div className="ci-comment__avatar">
        {avatar ? <img src={resolveUrl(avatar)} alt={username} onError={(e:any) => {
            try {
              const initial = (username || '?').charAt(0).toUpperCase();
              const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23d5ccc0'/><text x='50' y='66' font-size='50' text-anchor='middle' fill='%23666' font-family='Arial, sans-serif'>${initial}</text></svg>`;
              e.currentTarget.onerror = null
              e.currentTarget.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
            } catch { e.currentTarget.style.display = 'none' }
          }} /> : <span>{username.charAt(0).toUpperCase()}</span>}
      </div>
      <div className="ci-comment__body">
        <div className="ci-comment__header">
          <strong className="ci-comment__author">@{username}</strong>
        </div>
        <p className="ci-comment__text">{comment.text}</p>
      </div>
    </div>
  )
}

function buildCommentTree(comments: Comment[]) {
  const byId = new Map<string, Comment>()
  const children = new Map<string, Comment[]>()
  const roots: Comment[] = []

  comments.forEach((comment) => {
    if (comment._id) byId.set(comment._id, comment)
  })

  comments.forEach((comment) => {
    const parentId = comment.replyTo ? String(comment.replyTo) : ''
    if (parentId && byId.has(parentId)) {
      const list = children.get(parentId) || []
      list.push(comment)
      children.set(parentId, list)
    } else {
      roots.push(comment)
    }
  })

  return { roots, children }
}

function AvatarStack({ users, max = 4 }: { users: any[]; max?: number }) {
  if (!users.length) return null
  return (
    <div className="ci-avatar-stack">
      {users.slice(0, max).map((u, i) => {
        const name = typeof u === 'string' ? u : (u?.name || u?.username || '?')
        const avatar = getDisplayAvatar(u)
        return (
          <div key={i} className="ci-avatar-stack__item" style={{ zIndex: max - i }}>
            {avatar ? <img src={resolveUrl(avatar)} alt={name} onError={(e:any) => {
                try {
                  const initial = (name || '?').charAt(0).toUpperCase();
                  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23d5ccc0'/><text x='50' y='66' font-size='50' text-anchor='middle' fill='%23666' font-family='Arial, sans-serif'>${initial}</text></svg>`;
                  e.currentTarget.onerror = null
                  e.currentTarget.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
                } catch { e.currentTarget.style.display = 'none' }
              }} /> : <span>{name.charAt(0).toUpperCase()}</span>}
          </div>
        )
      })}
    </div>
  )
}

function getCurrentUserId() {
  try {
    const raw = sessionStorage.getItem('authUser')
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { _id?: string; username?: string; name?: string }
    return String(parsed._id || parsed.username || parsed.name || '')
  } catch {
    return ''
  }
}

function getDisplaySharedUsers(capsule: ApiCapsule | null) {
  const currentUserId = getCurrentUserId()
  const entries = [capsule?.owner, ...(capsule?.sharedWith ?? []), ...((capsule?.collaborators ?? []).map((item) => item.user))]

  const seen = new Set<string>()
  return entries
    .filter(Boolean)
    .filter((user) => {
      if (!currentUserId) return true
      if (typeof user === 'string') return String(user) !== currentUserId
      return String(user?._id || user?.username || user?.name || '') !== currentUserId
    })
    .filter((user) => {
      const key = typeof user === 'string' ? String(user) : String(user?._id || user?.username || user?.name || '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function getPrimaryDisplayUser(users: any[]) {
  return users.find((user) => getDisplayAvatar(user)) ?? users[0] ?? null
}

const SLIDE_GAP = 0

function CapsuleInterior() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)

  const [capsule, setCapsule] = useState<ApiCapsule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [generalCommentText, setGeneralCommentText] = useState('')
  const [generalReplyTarget, setGeneralReplyTarget] = useState<Comment | null>(null)
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Record<string, boolean>>({})
  const [photoCommentText, setPhotoCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [lightboxTextContent, setLightboxTextContent] = useState<string | null>(null)
  const [lightboxLoadingText, setLightboxLoadingText] = useState(false)

  // Measure carousel container so each slide matches the visible area exactly
  const carouselRef = useRef<HTMLDivElement>(null)
  const generalCommentInputRef = useRef<HTMLInputElement>(null)
  const [slideWidth, setSlideWidth] = useState(0)

  // Runs again when loading→false so the carousel is in the DOM before we measure
  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    const measure = () => setSlideWidth(el.offsetWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading])

  const mediaItems = (capsule?.mediaItems || []).filter((media) => getMediaKind(media) !== '3d')

  useEffect(() => {
    if (!id) { setError(txt('ID de capsula no encontrado', 'Capsule ID not found')); setLoading(false); return }
    const token = sessionStorage.getItem('authToken')
    if (!token) { navigate('/login', { replace: true }); return }
    let active = true
    fetchCapsuleById(id)
      .then((data) => { if (active) { setCapsule(data); setLoading(false) } })
      .catch(() => { if (active) { setError(txt('No se pudo cargar la capsula', 'Could not load capsule')); setLoading(false) } })
    return () => { active = false }
  }, [id, navigate, language])

  // Load text content for lightbox when a text media is opened
  useEffect(() => {
    let active = true
    const loadText = async () => {
      setLightboxTextContent(null)
      if (lightboxIndex === null) return
      const media = mediaItems[lightboxIndex]
      if (!media) return
      const kind = getMediaKind(media)
      if (kind !== 'text') return
      const src = resolveUrl(media.url)
      try {
        setLightboxLoadingText(true)
        const res = await fetch(src)
        if (!active) return
        if (!res.ok) throw new Error('Could not fetch text')
        const txtContent = await res.text()
        if (active) setLightboxTextContent(txtContent)
      } catch (err) {
        if (active) setLightboxTextContent(null)
      } finally {
        if (active) setLightboxLoadingText(false)
      }
    }
    loadText()
    return () => { active = false }
  }, [lightboxIndex])

  const goToSlide = (index: number) => {
    if (index >= 0 && index < mediaItems.length) setActiveSlideIndex(index)
  }

  const handleReplyClick = (comment: Comment) => {
    const author = typeof comment.author === 'string' ? { name: comment.author } : comment.author
    const username = (author as any).username || (author as any).name || 'Usuario'
    setGeneralReplyTarget(comment)
    setGeneralCommentText(`@${username} `)
    window.requestAnimationFrame(() => {
      generalCommentInputRef.current?.focus()
      const value = generalCommentInputRef.current?.value || ''
      generalCommentInputRef.current?.setSelectionRange(value.length, value.length)
    })
  }

  const handleSubmitGeneralComment = async () => {
    if (!generalCommentText.trim() || !capsule || !id) return
    setSubmittingComment(true)
    try {
      const token = sessionStorage.getItem('authToken')
      const res = await fetch(
        `${API_BASE_URL}/api/capsules/${id}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            text: generalCommentText,
            replyTo: generalReplyTarget?._id ?? undefined,
          }),
        }
      )
      if (res.ok) {
        setGeneralCommentText('')
        setGeneralReplyTarget(null)
        setCapsule(await fetchCapsuleById(id))
      }
    } catch (err) {
      console.error('Error submitting comment:', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleSubmitPhotoComment = async () => {
    const mediaIndex = lightboxIndex ?? activeSlideIndex
    const media = mediaItems[mediaIndex]
    if (!photoCommentText.trim() || !capsule || !media || !id) return
    const mediaId = media._id
    if (!mediaId) return
    setSubmittingComment(true)
    try {
      const token = sessionStorage.getItem('authToken')
      const res = await fetch(
        `${API_BASE_URL}/api/capsules/${id}/media/${mediaId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: photoCommentText }),
        }
      )
      if (res.ok) {
        setPhotoCommentText('')
        setCapsule(await fetchCapsuleById(id))
      }
    } catch (err) {
      console.error('Error submitting photo comment:', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  const canEdit = () => {
    const authUser = sessionStorage.getItem('authUser')
    if (!authUser || !capsule) return false
    try {
      const user = JSON.parse(authUser)
      const ownerId = typeof capsule.owner === 'string' ? capsule.owner : capsule.owner?._id
      return (
        user._id === ownerId ||
        capsule.collaborators?.some(
          (c) =>
            (typeof c.user === 'string' ? c.user : c.user._id) === user._id &&
            (c.role === 'admin' || c.role === 'edit')
        )
      )
    } catch {
      return false
    }
  }

  const header = (
    <header className="mobile-header" aria-label={txt('Interior de capsula', 'Capsule interior')}>
      <button type="button" className="mobile-header__left" onClick={() => navigate(-1)} aria-label={txt('Volver', 'Back')}>←</button>
      <Link to="/inicio" className="logo-button" aria-label={txt('Ir a inicio', 'Go home')}>
        <img src={logo} alt="Momentum" />
      </Link>
      <span className="mobile-header__right" aria-hidden="true" />
    </header>
  )

  if (loading) return (
    <Fragment>{header}<section className="page-layout"><p>{txt('Cargando...', 'Loading...')}</p></section></Fragment>
  )

  if (error || !capsule) return (
    <Fragment>{header}<section className="page-layout"><p>{error}</p></section></Fragment>
  )

  const locked = isTimeCapsuleLocked(capsule)
  const unlockDateLabel = formatUnlockDate(capsule.timeCapsule?.unlockAt)

  if (locked) {
    return (
      <Fragment>
        {header}
        <section className="ci-page ci-page--locked">
          <div className="ci-locked-card" aria-live="polite">
            <div className="ci-locked-card__icon" aria-hidden="true">🔒</div>
            <h1 className="ci-locked-card__title">{capsule.title}</h1>
            <p className="ci-locked-card__text">
              {txt('Esta cápsula del tiempo todavía está bloqueada.', 'This time capsule is still locked.')}
            </p>
            {unlockDateLabel && (
              <p className="ci-locked-card__date">
                {txt('Espera hasta', 'Wait until')} {unlockDateLabel}
              </p>
            )}
            <button type="button" className="ci-locked-card__button" onClick={() => navigate(-1)}>
              {txt('Volver', 'Back')}
            </button>
          </div>
        </section>
      </Fragment>
    )
  }

  const generalComments: Comment[] = (capsule as any)?.comments || []
  const generalCommentTree = buildCommentTree(generalComments)
  const sharedUsers = getDisplaySharedUsers(capsule)
  const primaryUser = getPrimaryDisplayUser(sharedUsers)

  const owner = capsule.owner
  const ownerName = typeof owner === 'string' ? owner : ((owner as any)?.name || (owner as any)?.username || 'Usuario')
  const ownerUsername = typeof owner === 'string' ? owner : ((owner as any)?.username || ownerName)
  const ownerAvatar = typeof owner === 'string' ? null : (owner as any)?.avatar ?? null

  // Thumbnail: usa la imagen del 3D model (igual que en el inicio) o la primera imagen
  const { thumbnailUrl: capsuleThumbUrl } = getCapsuleThumb(capsule)
  const thumbSrc = capsuleThumbUrl ? resolveUrl(capsuleThumbUrl) : null

  // Lightbox
  const lightboxMedia = lightboxIndex !== null ? mediaItems[lightboxIndex] : null
  const lightboxComments: Comment[] = (lightboxMedia as any)?.comments || []

  

  // Carousel translate — JS uses measured px; CSS fallback caps at 600px (no black margins)
  const translateX = slideWidth > 0
    ? `${activeSlideIndex * -(slideWidth + SLIDE_GAP)}px`
    : `calc(${activeSlideIndex} * -1 * 100%)`

  const renderGeneralComment = (comment: Comment, depth = 0) => {
    const replies = generalCommentTree.children.get(String(comment._id || '')) || []
    const commentId = String(comment._id || '')
    const repliesExpanded = expandedReplyThreads[commentId] ?? replies.length < 2

    return (
      <div key={comment._id || `comment-${comment.createdAt || Math.random()}`} className="ci-comment-thread">
        <div className={`ci-comment-thread__item${depth > 0 ? ' ci-comment-thread__item--reply' : ''}`}>
          <CommentRow comment={comment} />
          {depth === 0 && (
            <button
              type="button"
              className="ci-comment-reply-action"
              onClick={() => handleReplyClick(comment)}
            >
              {txt('Contestar', 'Reply')}
            </button>
          )}
        </div>
        {replies.length > 0 && repliesExpanded && (
          <div className="ci-comment-thread__children">
            {replies.map((reply) => renderGeneralComment(reply, depth + 1))}
          </div>
        )}
        {depth === 0 && replies.length > 1 && !repliesExpanded && (
          <button
            type="button"
            className="ci-comment-thread__toggle"
            onClick={() => setExpandedReplyThreads((current) => ({ ...current, [commentId]: true }))}
          >
            {txt('Mostrar respuestas', 'Show replies')} ({replies.length})
          </button>
        )}
        {depth === 0 && replies.length > 1 && repliesExpanded && (
          <button
            type="button"
            className="ci-comment-thread__toggle"
            onClick={() => setExpandedReplyThreads((current) => ({ ...current, [commentId]: false }))}
          >
            {txt('Ocultar respuestas', 'Hide replies')}
          </button>
        )}
      </div>
    )
  }

  const renderMedia = (media: any, idx: number) => {
    const src = resolveUrl(media.url)
    const filteredIdx = mediaItems.indexOf(media)
    const author = getMediaAuthor(media)
    const fallbackOwner = typeof capsule.owner === 'object' ? capsule.owner : null
    const effectiveAuthor = author || fallbackOwner
    const authorName = effectiveAuthor?.name || effectiveAuthor?.username || 'Usuario'
    const authorAvatar = getUserAvatar(effectiveAuthor)
    const fileName = media.title?.trim() || getFileName(media.url)
    const kind = getMediaKind(media)

    return (
      <div
        key={media._id || idx}
        className="ci-slide"
        style={slideWidth > 0 ? { width: `${slideWidth}px` } : undefined}
      >
        <div className="ci-slide__author" aria-label={`${txt('Subido por', 'Uploaded by')} ${authorName}`}>
          {authorAvatar
            ? <img src={authorAvatar} alt={authorName} />
            : <span>{authorName.charAt(0).toUpperCase()}</span>}
        </div>

        {kind === 'image' ? (
          <img
            src={src}
            alt={fileName}
            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }}
            onClick={() => navigate(`/capsulas/${capsule._id}/media/${idx}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/capsulas/${capsule._id}/media/${idx}`)
            }}
            aria-label={txt('Ver imagen ampliada', 'View enlarged image')}
          />
        ) : kind === 'video' ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <video
              src={src}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              controls
              playsInline
              aria-label={txt('Ver video', 'View video')}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/capsulas/${capsule._id}/media/${idx}`) }}
              className="ci-slide__open-btn"
              aria-label={txt('Abrir video', 'Open video')}
              style={{ position: 'absolute', right: 10, top: 10, zIndex: 5, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 8px' }}
            >{txt('Abrir', 'Open')}</button>
          </div>
        ) : kind === 'audio' ? (
          <div
            className="ci-slide__audio"
            style={{ position: 'relative', cursor: 'default' }}
            aria-label={txt('Ver audio', 'View audio')}
          >
            <div className="ci-slide__media-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 18V5l12-2v13" />
                <circle cx="7" cy="18" r="3" />
                <circle cx="19" cy="16" r="3" />
              </svg>
              <span>{fileName}</span>
            </div>
            <audio src={src} controls style={{ width: '90%' }} />
          </div>
        ) : kind === '3d' ? (
          <CapsulaThumb3D modelUrl={src} title={fileName} className="capsula-thumb--3d--full" style={{ width: '100%', height: '100%' }} />
        ) : kind === 'pdf' ? (
          <button
            type="button"
            onClick={() => setLightboxIndex(filteredIdx)}
            style={{ width: '100%', height: '100%', border: 'none', background: '#f6f1e8', cursor: 'pointer', padding: 20 }}
            aria-label={txt('Abrir PDF', 'Open PDF')}
          >
            <object
              data={src}
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
            onClick={() => setLightboxIndex(filteredIdx)}
            style={{ width: '100%', height: '100%', border: 'none', background: '#f6f1e8', cursor: 'pointer', padding: 20, textAlign: 'left' }}
            aria-label={txt('Abrir archivo de texto', 'Open text file')}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', overflow: 'hidden' }}>
              <span style={{ textDecoration: 'underline', color: 'var(--color-texto-principal)' }}>{fileName}</span>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--color-texto-secundario)', overflow: 'hidden' }}>{txt('Toca para ver el archivo de texto', 'Tap to view text file')}</pre>
            </div>
          </button>
        ) : (
          <div className="ci-slide__file">
            <div className="ci-slide__media-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                <path d="M14 2v5h5" />
              </svg>
              <span>{fileName}</span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/capsulas/${capsule._id}/media/${idx}`) }}
              className="ci-slide__open-btn"
              aria-label={txt('Abrir audio', 'Open audio')}
              style={{ position: 'absolute', right: 10, top: 10, zIndex: 5, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 8px' }}
            >{txt('Abrir', 'Open')}</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Fragment>
      {header}

      {/* ── Lightbox: foto ampliada + comentarios de esa foto ── */}
      {lightboxIndex !== null && lightboxMedia && (
        <div
          className="ci-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={txt('Ver foto', 'View photo')}
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="ci-lightbox__close"
            onClick={() => setLightboxIndex(null)}
            aria-label={txt('Cerrar', 'Close')}
          >×</button>

          <div className="ci-lightbox__content" onClick={(e) => e.stopPropagation()}>
            <div className="ci-lightbox__img-wrap">
              {lightboxMedia && getMediaKind(lightboxMedia) === 'video' ? (
                <video src={resolveUrl(lightboxMedia.url)} className="ci-lightbox__media" controls />
              ) : lightboxMedia && getMediaKind(lightboxMedia) === 'pdf' ? (
                <object data={resolveUrl(lightboxMedia.url)} type="application/pdf" className="ci-lightbox__media" style={{ width: '100%', height: '100%' }}>
                  <p>{txt('PDF no soportado en este navegador', 'PDF not supported in this browser')}</p>
                </object>
              ) : lightboxMedia && getMediaKind(lightboxMedia) === 'text' ? (
                <div className="ci-lightbox__media" style={{ padding: 16, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                  {lightboxLoadingText ? (
                    <p>{txt('Cargando...', 'Loading...')}</p>
                  ) : lightboxTextContent !== null ? (
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{lightboxTextContent}</pre>
                  ) : (
                    <p>{txt('No se pudo cargar el archivo de texto', 'Could not load text file')}</p>
                  )}
                </div>
              ) : (
                <img src={resolveUrl(lightboxMedia?.url || '')} alt={txt('Foto ampliada', 'Enlarged photo')} className="ci-lightbox__media" />
              )}
            </div>

            <div className="ci-lightbox__comments">
              <h3 className="ci-lightbox__comments-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {txt('Comentarios', 'Comments')}
              </h3>

              {lightboxComments.length > 0 ? (
                <div className="ci-comments__list">
                  {lightboxComments.map((c) => (
                    <CommentRow key={c._id || String(Math.random())} comment={c} />
                  ))}
                </div>
              ) : (
                <p className="ci-comments__empty">{txt('Sin comentarios todavia', 'No comments yet')}</p>
              )}

              <div className="ci-comment-input">
                <input
                  type="text"
                  className="ci-comment-input__field"
                  placeholder={txt('comentar algo...', 'comment something...')}
                  value={photoCommentText}
                  onChange={(e) => setPhotoCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitPhotoComment() }}
                  aria-label={txt('Comentar esta foto', 'Comment this photo')}
                />
                <button
                  type="button"
                  className="ci-comment-input__send-text"
                  onClick={handleSubmitPhotoComment}
                  disabled={submittingComment || !photoCommentText.trim()}
                >{txt('Enviar', 'Send')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="ci-page">

        {/* ── Header: thumbnail + título + avatares + editar ── */}
        <div className="ci-header">
          <div className="ci-header__left">
            {thumbSrc && (
              <img src={thumbSrc} alt="" className="ci-header__thumb" aria-hidden="true" />
            )}
            <div className="ci-header__text">
              <h1 className="ci-header__title">{capsule.title}</h1>
              <AvatarStack users={primaryUser ? [primaryUser] : sharedUsers} max={1} />
            </div>
          </div>
          {canEdit() && (
            <button
              type="button"
              className="ci-header__edit"
              onClick={() => navigate(`/capsulas/${id}/editar`)}
              aria-label={txt('Editar capsula', 'Edit capsule')}
            >
              {txt('editar', 'edit')}
              <img src={iconEdit} alt="" width={13} height={13} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* ── Carrusel con peek ── */}
        {mediaItems.length > 0 ? (
          <div className="ci-carousel-wrap" aria-label={txt('Fotos de la capsula', 'Capsule photos')}>
            <div className="ci-carousel-outer" ref={carouselRef}>
              <div
                className="ci-carousel-track"
                style={{ transform: `translateX(${translateX})` }}
              >
                {mediaItems.map((media) => {
                  const realIdx = capsule.mediaItems?.indexOf(media) ?? -1
                  return realIdx >= 0 ? renderMedia(media, realIdx) : null
                })}
              </div>
            </div>

            {mediaItems.length > 1 && (
              <div className="ci-carousel-controls">
                <button
                  type="button"
                  className="ci-carousel__arrow"
                  onClick={() => goToSlide(activeSlideIndex - 1)}
                  disabled={activeSlideIndex === 0}
                  aria-label={txt('Foto anterior', 'Previous photo')}
                >‹</button>
                <div className="ci-dots" role="tablist">
                  {mediaItems.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      role="tab"
                      aria-selected={idx === activeSlideIndex}
                      className={`ci-dot${idx === activeSlideIndex ? ' ci-dot--active' : ''}`}
                      onClick={() => goToSlide(idx)}
                      aria-label={`${txt('Foto', 'Photo')} ${idx + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="ci-carousel__arrow"
                  onClick={() => goToSlide(activeSlideIndex + 1)}
                  disabled={activeSlideIndex === mediaItems.length - 1}
                  aria-label={txt('Foto siguiente', 'Next photo')}
                >›</button>
              </div>
            )}
          </div>
        ) : (
          <p className="ci-no-media">{txt('No hay fotos o videos en esta capsula', 'There are no photos or videos in this capsule')}</p>
        )}

        {/* ── Descripción ── */}
        {capsule.description && (
          <div className="ci-description">
            <h2 className="ci-description__label">{txt('Descripcion', 'Description')}</h2>
            <div className="ci-description__owner">
              <div className="ci-description__avatar">
                {ownerAvatar
                  ? <img src={ownerAvatar} alt={ownerName} />
                  : <span>{ownerName.charAt(0).toUpperCase()}</span>}
              </div>
              <span className="ci-description__username">@{ownerUsername}</span>
            </div>
            <p className="ci-description__text">{capsule.description}</p>
          </div>
        )}

        {/* ── Comentarios generales ── */}
        <section className="ci-comments" aria-label={txt('Comentarios', 'Comments')}>
          <h2 className="ci-comments__title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {txt('Comentarios', 'Comments')}
          </h2>

          {generalComments.length > 0 ? (
            <div className="ci-comments__list">
              {generalCommentTree.roots.map((comment) => renderGeneralComment(comment))}
            </div>
          ) : (
            <p className="ci-comments__empty">{txt('Sin comentarios todavia', 'No comments yet')}</p>
          )}

          {generalReplyTarget && (
            <div className="ci-comment-replying" role="status" aria-live="polite">
              <span>
                {txt('Respondiendo a', 'Replying to')} @{typeof generalReplyTarget.author === 'string'
                  ? generalReplyTarget.author
                  : ((generalReplyTarget.author as any).username || (generalReplyTarget.author as any).name || 'Usuario')}
              </span>
              <button type="button" className="ci-comment-replying__cancel" onClick={() => setGeneralReplyTarget(null)}>
                {txt('Cancelar', 'Cancel')}
              </button>
            </div>
          )}

          <div className="ci-comment-input">
            <input ref={generalCommentInputRef} type="text"
              className="ci-comment-input__field"
              placeholder={generalReplyTarget ? txt('escribe tu respuesta...', 'write your reply...') : txt('comentar algo...', 'comment something...')}
              value={generalCommentText}
              onChange={(e) => setGeneralCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitGeneralComment() }}
              aria-label={txt('Nuevo comentario', 'New comment')}
            />
            <button
              type="button"
              className="ci-comment-input__send-text"
              onClick={handleSubmitGeneralComment}
              disabled={submittingComment || !generalCommentText.trim()}
            >{generalReplyTarget ? txt('Responder', 'Reply') : txt('Enviar', 'Send')}</button>
          </div>
        </section>

      </section>
    </Fragment>
  )
}

export default CapsuleInterior
