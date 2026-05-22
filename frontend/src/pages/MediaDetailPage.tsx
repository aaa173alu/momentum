import { Fragment, useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset } from '../img'
import { API_BASE_URL, fetchCapsuleById, type ApiCapsule } from '../services/api'
import { useTranslate } from '../services/useTranslate'
import '../styles/media-detail.css'

interface Comment {
  _id?: string
  author: { _id?: string; username?: string; name: string; avatar?: string } | string
  text: string
  createdAt?: string
  replyTo?: string | null
}

function resolveUrl(url: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`
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
  }
  
  // Check explicit type field
  if (type === '3d') return '3d'
  if (type === 'audio') return 'audio'
  if (type === 'video') return 'video'
  if (type === 'image') return 'image'
  
  // Check title/filename for extension
  if (title) {
    const titleLower = title.toLowerCase()
    if (/\.(glb|gltf|obj|fbx|stl)$/i.test(titleLower)) return '3d'
    if (/\.(mp3|wav|ogg|oga|m4a|aac|flac|webm)$/i.test(titleLower)) return 'audio'
    if (/\.(mp4|mov|webm|ogg|avi|mkv)$/i.test(titleLower)) return 'video'
    if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(titleLower)) return 'image'
    if (/\.(pdf)$/i.test(titleLower)) return 'pdf'
  }
  
  // Check URL for extension (fallback)
  const urlLower = url.toLowerCase()
  if (/\.(glb|gltf|obj|fbx|stl)(\?.*)?$/i.test(urlLower)) return '3d'
  if (/\.(mp3|wav|ogg|oga|m4a|aac|flac|webm)(\?.*)?$/i.test(urlLower)) return 'audio'
  if (/\.(mp4|mov|webm|ogg|avi|mkv)(\?.*)?$/i.test(urlLower)) return 'video'
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(urlLower)) return 'image'
  if (/\.(pdf)(\?.*)?$/i.test(urlLower)) return 'pdf'
  
  return 'file'
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

function getUserAvatar(user: any) {
  return user?.avatar || user?.profilePhoto || ''
}

function CommentRow({ comment }: { comment: Comment }) {
  const a = typeof comment.author === 'string' ? { name: comment.author } : comment.author
  const username = (a as any).username || (a as any).name || 'Usuario'
  const avatar = getUserAvatar(a)
  return (
    <div className="ci-comment">
      <div className="ci-comment__avatar">
        {avatar ? <img src={resolveUrl(avatar)} alt={username} /> : <span>{username.charAt(0).toUpperCase()}</span>}
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

export default function MediaDetailPage() {
  const { id: capsuleId, mediaIndex: mediaIndexStr } = useParams()
  const navigate = useNavigate()
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const { t } = useTranslate()
  
  const mediaIndex = mediaIndexStr ? parseInt(mediaIndexStr, 10) : 0
  const [capsule, setCapsule] = useState<ApiCapsule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [commentText, setCommentText] = useState('')
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null)
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Record<string, boolean>>({})
  const [submittingComment, setSubmittingComment] = useState(false)
  const commentInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const data = await fetchCapsuleById(capsuleId!)
        setCapsule(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading capsule')
      } finally {
        setLoading(false)
      }
    }
    if (capsuleId) load()
  }, [capsuleId])

  if (loading) return <main className="md-page"><p>{t('loading')}</p></main>
  if (error || !capsule) return <main className="md-page"><p>{error || t('loadError')}</p></main>

  const mediaItems = capsule.mediaItems || []
  const validIndex = Math.max(0, Math.min(mediaIndex, mediaItems.length - 1))
  const media = mediaItems[validIndex]
  const kind = media ? getMediaKind(media) : 'unknown'
  const src = media ? resolveUrl(media.url) : ''
  const fileName = media ? (media.title?.trim() || getFileName(media.url)) : 'N/A'
  
  const author = media?.author && typeof media.author === 'object' ? media.author : null
  const authorName = author?.name || author?.username || (typeof capsule.owner === 'object' ? capsule.owner.name : 'Usuario')
  const authorAvatar = author ? getUserAvatar(author) : (typeof capsule.owner === 'object' ? getUserAvatar(capsule.owner) : '')

  const mediaComments: Comment[] = media?.comments || []
  const mediaCommentTree = buildCommentTree(mediaComments)

  const handleReplyClick = (comment: Comment) => {
    const commentAuthor = typeof comment.author === 'string' ? { name: comment.author } : comment.author
    const username = (commentAuthor as any).username || (commentAuthor as any).name || 'Usuario'
    setReplyTarget(comment)
    setCommentText(`@${username} `)
    window.requestAnimationFrame(() => {
      commentInputRef.current?.focus()
      const value = commentInputRef.current?.value || ''
      commentInputRef.current?.setSelectionRange(value.length, value.length)
    })
  }

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !capsule || !media || !capsuleId) return
    const mediaId = media._id
    if (!mediaId) return
    setSubmittingComment(true)
    try {
      const token = sessionStorage.getItem('authToken')
      const res = await fetch(
        `${API_BASE_URL}/api/capsules/${capsuleId}/media/${mediaId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            text: commentText,
            replyTo: replyTarget?._id ?? undefined,
          }),
        }
      )
      if (res.ok) {
        setCommentText('')
        setReplyTarget(null)
        setCapsule(await fetchCapsuleById(capsuleId))
      }
    } catch (err) {
      console.error('Error submitting comment:', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  function renderComment(comment: Comment, depth = 0) {
    const replies = mediaCommentTree.children.get(String(comment._id || '')) || []
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
              Responder
            </button>
          )}
        </div>
        {replies.length > 0 && repliesExpanded && (
          <div className="ci-comment-thread__children">
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
        {depth === 0 && replies.length > 1 && !repliesExpanded && (
          <button
            type="button"
            className="ci-comment-thread__toggle"
            onClick={() => setExpandedReplyThreads((current) => ({ ...current, [commentId]: true }))}
          >
            Mostrar respuestas ({replies.length})
          </button>
        )}
      </div>
    )
  }

  return (
    <Fragment>
      <header className="md-header">
        <button type="button" className="md-header__back" onClick={() => navigate(-1)} aria-label={t('back')}>←</button>
        <Link to="/inicio" className="md-header__logo" aria-label={t('homeTitle')}>
          <img src={logo} alt="Momentum" />
        </Link>
      </header>

      <main className="md-page">
        <div className="md-container">
          {/* Viewer */}
          <div className="md-viewer">
            {kind === 'image' ? (
              <img src={src} alt={fileName} className="md-viewer__image" />
            ) : kind === 'video' ? (
              <video src={src} className="md-viewer__video" controls autoPlay playsInline />
            ) : kind === 'audio' ? (
              <div className="md-viewer__audio-wrap">
                <div className="md-viewer__audio-info">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="md-viewer__audio-icon">
                    <path d="M9 18V5l12-2v13M7 18a3 3 0 1 1 6 0 3 3 0 0 1-6 0M19 16a3 3 0 1 1 6 0 3 3 0 0 1-6 0" />
                  </svg>
                  <h2>{fileName}</h2>
                </div>
                <audio src={src} controls className="md-viewer__audio" autoPlay />
              </div>
            ) : kind === 'pdf' ? (
              <object
                data={src}
                type="application/pdf"
                className="md-viewer__pdf"
              >
                <p>No se puede visualizar el PDF. <a href={src} target="_blank" rel="noreferrer">Descargar</a></p>
              </object>
            ) : kind === '3d' ? (
              <div className="md-viewer__3d-placeholder">
                <div className="md-viewer__3d-label">3D</div>
                <p>{fileName}</p>
                <p className="md-viewer__3d-hint">Vista 3D disponible en la galería</p>
              </div>
            ) : (
              <div className="md-viewer__file-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="md-viewer__file-icon">
                  <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                  <path d="M14 2v5h5" />
                </svg>
                <p>{fileName}</p>
                <a href={src} download target="_blank" rel="noreferrer" className="md-viewer__download-btn">
                  Descargar
                </a>
              </div>
            )}
          </div>

          {/* Info & Comments Sidebar */}
          <div className="md-sidebar">
            {/* Author Info */}
            <div className="md-info">
              <div className="md-info__title">{fileName}</div>
              <div className="md-info__meta">
                <div className="md-info__author">
                  <div className="md-info__avatar">
                    {authorAvatar ? (
                      <img src={authorAvatar} alt={authorName} />
                    ) : (
                      <span>{authorName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="md-info__author-text">
                    <div className="md-info__author-name">{authorName}</div>
                    <div className="md-info__author-role">Subió el contenido</div>
                  </div>
                </div>
                {media?.description && (
                  <div className="md-info__description">{media.description}</div>
                )}
              </div>
            </div>

            {/* Comments Section */}
            <section className="ci-comments" aria-label="Comentarios">
              <h2 className="ci-comments__title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Comentarios
              </h2>

              {mediaCommentTree.roots.length > 0 ? (
                <div className="ci-comments__list">
                  {mediaCommentTree.roots.map((comment) => renderComment(comment))}
                </div>
              ) : (
                <p className="ci-comments__empty">Sin comentarios todavía</p>
              )}

              {replyTarget && (
                <div className="ci-comment-replying" role="status" aria-live="polite">
                  <span>
                    Respondiendo a @{typeof replyTarget.author === 'string'
                      ? replyTarget.author
                      : ((replyTarget.author as any).username || (replyTarget.author as any).name || 'Usuario')}
                  </span>
                  <button type="button" className="ci-comment-replying__cancel" onClick={() => setReplyTarget(null)}>
                    Cancelar
                  </button>
                </div>
              )}

              <div className="ci-comment-input">
                <input
                  ref={commentInputRef}
                  type="text"
                  className="ci-comment-input__field"
                  placeholder={replyTarget ? 'Escribe tu respuesta...' : 'Comentar algo...'}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment() }}
                  aria-label="Nuevo comentario"
                />
                <button
                  type="button"
                  className="ci-comment-input__send-text"
                  onClick={handleSubmitComment}
                  disabled={submittingComment || !commentText.trim()}
                >{replyTarget ? 'Responder' : 'Enviar'}</button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </Fragment>
  )
}
