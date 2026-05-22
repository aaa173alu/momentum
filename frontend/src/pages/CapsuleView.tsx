import { useEffect, useState, Fragment } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset } from '../img'
import { API_BASE_URL, fetchCapsuleById, type ApiCapsule, type ApiMediaItem } from '../services/api'
import { useTranslate } from '../services/useTranslate'
import { Model3DViewer } from '../3d/Model3DViewer'
import '../styles/capsule-view.css'
const FALLBACK_MODEL = '/3d/liberty.glb'

function resolveUrl(url: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('//') || url.startsWith('data:') || url.startsWith('blob:')) return url
  if (url.startsWith('/3d/')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`
}

function find3DModel(items: ApiMediaItem[] | undefined) {
  return items?.find((m) => m.type === '3d') ?? null
}

function getUserAvatarUrl(user: any) {
  if (!user || typeof user === 'string') return ''
  return user.avatar || user.profilePhoto || user.photo || user.image || user.avatarUrl || ''
}

function AvatarStack({ users, max = 4, size = 28 }: { users: any[]; max?: number; size?: number }) {
  if (!users.length) return null
  const visible = users.slice(0, max)
  return (
    <div className="cv-avatar-stack" aria-hidden="true">
      {visible.map((u, i) => {
        const name = typeof u === 'string' ? u : (u?.name || u?.username || '?')
        const avatar = typeof u === 'string' ? null : (u?.avatar || u?.profilePhoto || '')
        return (
          <div
            key={i}
            className="cv-avatar-stack__item"
            style={{ width: size, height: size, zIndex: max - i }}
          >
            {avatar
              ? <img
                  src={resolveUrl(avatar)}
                  alt={name}
                  onError={(e: any) => {
                    try {
                      const initial = (name || '?').charAt(0).toUpperCase()
                      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23d5ccc0'/><text x='50' y='66' font-size='50' text-anchor='middle' fill='%23666' font-family='Arial, sans-serif'>${initial}</text></svg>`
                      e.currentTarget.onerror = null
                      e.currentTarget.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
                    } catch {
                      e.currentTarget.style.display = 'none'
                    }
                  }}
                />
              : <span>{name.charAt(0).toUpperCase()}</span>}
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
  return users.find((user) => getUserAvatarUrl(user)) ?? users[0] ?? null
}

function CapsuleView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const [capsule, setCapsule] = useState<ApiCapsule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const header = (
    <header className="mobile-header" aria-label={txt('Vista previa de capsula', 'Capsule preview')}>
      <button type="button" className="mobile-header__left" onClick={() => navigate(-1)} aria-label={txt('Volver', 'Back')}>←</button>
      <Link to="/inicio" className="logo-button" aria-label={txt('Ir a inicio', 'Go home')}>
        <img src={logo} alt="Momentum" />
      </Link>
      <span className="mobile-header__right" aria-hidden="true" />
    </header>
  )

  if (loading) return (
    <Fragment>
      <header className="mobile-header">
        <span className="mobile-header__left" />
        <span className="mobile-header__right" />
      </header>
      <section className="page-layout"><p>{txt('Cargando...', 'Loading...')}</p></section>
    </Fragment>
  )

  if (error || !capsule) return (
    <Fragment>
      {header}
      <section className="page-layout"><p>{error}</p></section>
    </Fragment>
  )

  const model3D = find3DModel(capsule.mediaItems)
  const modelPath = model3D ? resolveUrl(model3D.url) : FALLBACK_MODEL
  const sharedUsers = getDisplaySharedUsers(capsule)
  const primaryUser = getPrimaryDisplayUser(sharedUsers)

  return (
    <Fragment>
      {header}

      <section className="capsule-view">

        {/* Título + avatares */}
        <div className="capsule-view__title-row">
          <h1 className="capsule-view__title">{capsule.title}</h1>
          <AvatarStack users={primaryUser ? [primaryUser] : sharedUsers} max={1} size={30} />
        </div>

        {/* Viewer 3D — limpio, sin halo */}
        <div className="capsule-view__model-wrapper">
          <Model3DViewer modelPath={modelPath} backgroundColor="transparent" />
        </div>

        {/* Botón Ver Cápsula */}
        <button
          type="button"
          className="capsule-view__button"
          onClick={() => navigate(`/capsulas/${id}/interior`)}
        >
          {txt('Ver Capsula', 'View Capsule')}
        </button>

        {/* Sección compartida */}
        {sharedUsers.length > 0 && (
          <section className="capsule-view__shared-section" aria-label={txt('Capsula compartida con', 'Capsule shared with')}>
            <span className="capsule-view__shared-pill">{txt('Capsula compartida', 'Shared capsule')}</span>
            <div className="capsule-view__shared-users">
              {sharedUsers.map((user) => {
                const u = typeof user === 'string' ? null : user
                const name = u?.name ?? u?.username ?? (typeof user === 'string' ? user : 'Usuario')
                const key = u?._id ?? (typeof user === 'string' ? user : String(Math.random()))
                const avatar = getUserAvatarUrl(u)
                const username = u?.username ?? name
                return (
                  <div key={key} className="capsule-view__friend-row">
                            <div className="capsule-view__friend-avatar">
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
                    <span className="capsule-view__friend-name">@{username}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </section>
    </Fragment>
  )
}

export default CapsuleView
