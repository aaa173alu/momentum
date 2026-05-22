import { Fragment, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset } from '../img'
import { fetchCapsules, fetchCurrentUser, fetchFriends, type ApiUser, type ApiCapsule } from '../services/api.ts'
import { useTranslate } from '../services/useTranslate'

function ProfilePage() {
  const navigate = useNavigate()
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const [user, setUser] = useState<ApiUser | null>(null)
  const [friendsCount, setFriendsCount] = useState(0)
  const [capsules, setCapsules] = useState<ApiCapsule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [me, friends, allCapsules] = await Promise.all([
          fetchCurrentUser().catch(() => null),
          fetchFriends().catch(() => []),
          fetchCapsules().catch(() => []),
        ])

        setUser(me)
        setFriendsCount(friends.length)
        setCapsules(allCapsules || [])
      } catch (err) {
        console.error('Error loading profile:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const recentCapsules = capsules.slice(0, 3)

  if (loading) {
    return (
      <Fragment>
        <header className="mobile-header" aria-label={txt('Mi perfil', 'My profile')}>
          <span className="mobile-header__left" aria-hidden="true" />
          <Link to="/inicio" className="logo-button" aria-label={txt('Ir a inicio', 'Go home')}>
            <img src={logo} alt="Momentum" />
          </Link>
          <button type="button" className="mobile-header__right" onClick={() => navigate('/ajustes')} aria-label={txt('Ajustes', 'Settings')}>⚙️</button>
        </header>
        <div className="page-layout"><p>{txt('Cargando...', 'Loading...')}</p></div>
      </Fragment>
    )
  }

  return (
    <Fragment>
      <header className="mobile-header" aria-label={txt('Mi perfil', 'My profile')}>
        <span className="mobile-header__left" aria-hidden="true" />
        <Link to="/inicio" className="logo-button" aria-label={txt('Ir a inicio', 'Go home')}>
          <img src={logo} alt="Momentum" />
        </Link>
        <button type="button" className="mobile-header__right" onClick={() => navigate('/ajustes')} aria-label={txt('Ajustes', 'Settings')}>⚙️</button>
      </header>
      <div className="profile-page">
      {/* Header */}
      <header className="profile-header">
        <h1 className="profile-header__title">{txt('MI PERFIL', 'MY PROFILE')}</h1>
        <div className="profile-header__logo">M</div>
        <button className="profile-header__settings" onClick={() => navigate('/ajustes')}>
          ⚙️
        </button>
      </header>

      {/* Profile Info */}
      <section className="profile-info">
        <img
          src={user?.profilePhoto || user?.avatar || '/img/default-avatar.png'}
          alt={user?.name}
          className="profile-info__image"
        />
        <div className="profile-info__username">
          @{user?.name?.toLowerCase().replace(/\s+/g, '') || txt('usuario', 'user')}
        </div>
        <div className="profile-info__stats">
          {friendsCount} {txt('amigos', 'friends')}
        </div>
      </section>

      {/* Recent Memories */}
      <section className="profile-memories">
        <h2 className="profile-memories__title">{txt('Últimos recuerdos', 'Recent memories')}</h2>

        {recentCapsules.length > 0 ? (
          <>
            <div className="profile-memories__grid">
              {recentCapsules.map((capsule) => (
                <div
                  key={capsule._id}
                  className="profile-memory-card"
                  onClick={() => navigate(`/capsulas/${capsule._id}`, { state: { capsule } })}
                  role="button"
                  tabIndex={0}
                >
                  {capsule.previewImage && (
                    <img src={capsule.previewImage} alt={capsule.title} />
                  )}
                  {capsule.mediaItems?.[0]?.thumbnailUrl && (
                    <img src={capsule.mediaItems[0].thumbnailUrl} alt={capsule.title} />
                  )}
                  <div className="profile-memory-card__overlay">
                    <p>{capsule.title}</p>
                  </div>
                </div>
              ))}
            </div>

            {capsules.length > 3 && (
              <button
                className="profile-memories__more"
                onClick={() => navigate('/capsulas')}
              >
                {txt('Ver más', 'View more')} &gt;
              </button>
            )}
          </>
        ) : (
          <p className="profile-memories__empty">
            {txt('No tienes recuerdos aún. ¡Crea tu primera cápsula!', 'You do not have any memories yet. Create your first capsule!')}
          </p>
        )}
      </section>
    </div>
    </Fragment>
  )
}

export default ProfilePage
