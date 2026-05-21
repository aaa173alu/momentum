import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import IconoTema from '../components/IconoTema'
import CapsulaThumb from '../components/CapsulaThumb'
import NotificationBell from '../components/NotificationBell'
import { logoMAsset, settingsIconAsset, settingsIconWhiteAsset, notificationIconAsset, notificationIconWhiteAsset } from '../img'
import { clearSession, getCapsuleThumb, type ApiCapsule } from '../services/api'
import { useTranslate } from '../services/useTranslate'
import '../styles/home.css'

type SharedCapsuleFriend = {
  _id: string
  name: string
  username: string
  avatar?: string
  capsules: ApiCapsule[]
}

function getCapsuleOwnerId(capsule: ApiCapsule) {
  const owner = capsule.owner
  if (!owner) return ''
  if (typeof owner === 'string') return owner
  return owner._id || ''
}

// Categorias definidas dinámicamente más abajo (localizadas)

function Dashboard() {
  const navigate = useNavigate()
  const { tema } = useTema()
  const { t, language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const settingsIcon = tema === 'oscuro' ? settingsIconWhiteAsset : settingsIconAsset
  const notificationIcon = tema === 'oscuro' ? notificationIconWhiteAsset : notificationIconAsset
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [capsulasDesbloqueadas, setCapsulasDesbloqueadas] = useState<ApiCapsule[]>([])
  const [misCapsulas, setMisCapsulas] = useState<ApiCapsule[]>([])
  const [amigosCompartidos, setAmigosCompartidos] = useState<SharedCapsuleFriend[]>([])
  const [loadingTiempo, setLoadingTiempo] = useState(false)
  const [loadingPerfil, setLoadingPerfil] = useState(false)
  const [loadingCompartidas, setLoadingCompartidas] = useState(false)

  const categorias = [
    { label: t('categoryTravel'), valor: 'viajes' },
    { label: t('categoryFamily'), valor: 'familia' },
    { label: t('categoryFriendship'), valor: 'amistad' },
    { label: t('categoryWork'), valor: 'trabajo' },
    { label: t('categoryOther'), valor: 'otros' },
  ]

  useEffect(() => {
    const token = sessionStorage.getItem('authToken')
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    let active = true

    const parseStoredUserId = () => {
      try {
        const storedUser = sessionStorage.getItem('authUser')
        if (!storedUser) return ''

        const parsed = JSON.parse(storedUser) as { _id?: string }
        return String(parsed._id || '')
      } catch {
        return ''
      }
    }

    const requestJson = async (path: string) => {
      const response = await fetch(path, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.status === 401) {
        clearSession()
        navigate('/login', { replace: true })
        return null
      }

      if (!response.ok) {
        return null
      }

      return response.json()
    }

    const load = async () => {
      setLoadingTiempo(true)
      setLoadingPerfil(true)
      setLoadingCompartidas(true)

      const userId = parseStoredUserId()

      try {
        const [capsulesData, sharedData, unlockedData] = await Promise.all([
          requestJson('/api/capsules'),
          requestJson('/api/friends/shared'),
          requestJson('/api/capsules?timeCapsule=unlocked'),
        ])

        if (!active) return

        if (Array.isArray(capsulesData)) {
          const visibleCapsules = userId
            ? capsulesData.filter((capsule) => {
              const ownerId = getCapsuleOwnerId(capsule)
              if (ownerId === userId) return true
              const shared = Array.isArray(capsule.sharedWith) && capsule.sharedWith.some((u: any) => (typeof u === 'string' ? u : u?._id) === userId)
              if (shared) return true
              const collab = Array.isArray(capsule.collaborators) && capsule.collaborators.some((c: any) => (typeof c.user === 'string' ? c.user : c.user?._id) === userId)
              if (collab) return true
              return false
            })
            : capsulesData

          setMisCapsulas(visibleCapsules.slice(0, 3))
        } else {
          setMisCapsulas([])
        }

        if (Array.isArray(sharedData)) {
          setAmigosCompartidos(sharedData)
        } else {
          setAmigosCompartidos([])
        }

        if (Array.isArray(unlockedData)) {
          setCapsulasDesbloqueadas(unlockedData)
        } else {
          setCapsulasDesbloqueadas([])
        }
      } finally {
        if (active) {
          setLoadingTiempo(false)
          setLoadingPerfil(false)
          setLoadingCompartidas(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [navigate])

  return (
    <>
      <header className="home-header" aria-label={txt('Encabezado principal', 'Main header')}>
        <span className="home-header__left" aria-hidden="true">
          <IconoTema />
        </span>
        <button type="button" className="home-header__logo-button" aria-label={txt('Recargar inicio', 'Reload home')} onClick={() => navigate('/inicio')}>
          <img className="mobile-header__logo" src={logo} alt="Momentum" />
        </button>
        <div className="home-header__right">
          <NotificationBell token={sessionStorage.getItem('authToken')} iconSrc={notificationIcon} />
          <button type="button" className="home-header__settings" aria-label={txt('Abrir ajustes', 'Open settings')} onClick={() => navigate('/ajustes')}>
            <img src={settingsIcon} alt="" aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="home-page" aria-label={txt('Pantalla principal de Momentum', 'Momentum main screen')}>
        {loadingTiempo ? (
          <div className="home-card home-card--unlock">
            <span className="home-loading-text">{txt('Cargando...', 'Loading...')}</span>
          </div>
        ) : capsulasDesbloqueadas.length > 0 ? (
          <article className="home-card home-card--unlock">
            <span className="home-card__icon" aria-hidden="true">
              ⏰
            </span>
            <div className="home-card__body">
              <p className="home-card__title">{txt('Tu capsula del tiempo esta lista!', 'Your time capsule is ready!')}</p>
              <p className="home-card__subtitle">
                {capsulasDesbloqueadas.length === 1 ? (
                  <em>{capsulasDesbloqueadas[0].title}</em>
                ) : (
                  txt(`Tienes ${capsulasDesbloqueadas.length} capsulas listas para abrir`, `You have ${capsulasDesbloqueadas.length} capsules ready to open`)
                )}
              </p>
            </div>
            <button
              type="button"
              className="home-card__action"
              onClick={() => {
                if (capsulasDesbloqueadas.length === 1) {
                  navigate(`/capsulas/${capsulasDesbloqueadas[0]._id}`)
                } else {
                  navigate('/mis-capsulas?filter=unlocked')
                }
              }}
            >
              {txt('Abrir', 'Open')}
            </button>
          </article>
        ) : null}

        <section className="home-profile-card" aria-labelledby="home-profile-title">
          <div className="home-profile-card__content">
            <h1 id="home-profile-title">{t('myProfile')}</h1>
            <div className="home-profile-card__thumbs" aria-label={txt('Capsulas recientes', 'Recent capsules')}>
              {loadingPerfil ? (
                <span className="home-loading-text">{txt('Cargando...', 'Loading...')}</span>
              ) : misCapsulas.length > 0 ? (
                misCapsulas.map((capsula) => (
                  <div key={capsula._id} className="home-thumb home-thumb--profile">
                    <div
                      className="home-thumb__halo"
                      style={{ background: `radial-gradient(circle, ${capsula.colorHalo || '#C8B89A'} 0%, transparent 72%)` }}
                      aria-hidden="true"
                    />
                    <div className="home-thumb__inner">
                      <CapsulaThumb
                        capsula={{ id: capsula._id, nombre: capsula.title || '', ...getCapsuleThumb(capsula) }}
                        onOpen={(id) => navigate(`/capsulas/${id}`)}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="home-empty-text">{t('noVisibleCapsules')}</p>
              )}
            </div>
          </div>
          <button type="button" className="home-profile-card__button" onClick={() => navigate('/perfil')}>
            {txt('Ir', 'Go')}
          </button>
        </section>

        <section className="home-search" aria-label={txt('Filtro por categoria y busqueda', 'Category and search filter')}>
          <form
            className="home-search__form"
            onSubmit={(event) => {
              event.preventDefault()
              navigate(`/buscar${categoriaSeleccionada ? `?category=${encodeURIComponent(categoriaSeleccionada)}` : ''}`)
            }}
          >
            <div className="home-search__field">
              <select
                className="home-search__input"
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                aria-label={txt('Buscar por categoria', 'Search by category')}
              >
                <option value="">{txt('Selecciona una categoria', 'Select a category')}</option>
                {categorias.map((cat) => (
                  <option key={cat.valor} value={cat.valor}>{cat.label}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="home-search__button">
              {txt('Buscar', 'Search')}
            </button>
          </form>
        </section>

        <section className="home-shared" aria-labelledby="home-shared-title">
          <h2 id="home-shared-title">{t('shareCapsules')}</h2>

          {loadingCompartidas ? (
            <p className="home-loading-text">{txt('Cargando...', 'Loading...')}</p>
          ) : amigosCompartidos.length > 0 ? (
            amigosCompartidos.map((amigo) => (
              <article key={amigo._id} className="home-shared-card">
                {amigo.avatar ? (
                  <img className="home-shared-card__avatar" src={amigo.avatar} alt={amigo.name} />
                ) : (
                  <div className="home-shared-card__avatar home-shared-card__avatar--fallback" aria-hidden="true">
                    {amigo.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="home-shared-card__main">
                  <p className="home-shared-card__user">@{amigo.username}</p>
                  <div className="home-shared-card__thumbs" aria-label={`${txt('Capsulas compartidas con', 'Capsules shared with')} ${amigo.name}`}>
                    {amigo.capsules.slice(0, 4).map((capsula) => (
                      <div key={capsula._id} className="home-thumb home-thumb--friend">
                        <div
                          className="home-thumb__halo"
                          style={{ background: `radial-gradient(circle, ${capsula.colorHalo || '#C8B89A'} 0%, transparent 72%)` }}
                          aria-hidden="true"
                        />
                        <div className="home-thumb__inner">
                          <CapsulaThumb
                            capsula={{ id: capsula._id, nombre: capsula.title || '', ...getCapsuleThumb(capsula) }}
                            onOpen={(id) => navigate(`/capsulas/${id}`)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button type="button" className="home-shared-card__more" onClick={() => navigate(`/amigos/${amigo._id}`)}>
                  {txt('Ver mas', 'See more')} &gt;
                </button>
              </article>
            ))
          ) : (
            <div className="home-shared__empty">
              <p>{t('noSharedCapsules')}</p>
              <button type="button" className="home-shared__empty-link" onClick={() => navigate('/amigos')}>
                {txt('Ir a mis amigos', 'Go to my friends')} &gt;
              </button>
            </div>
          )}
        </section>
      </section>
    </>
  )
}

export default Dashboard