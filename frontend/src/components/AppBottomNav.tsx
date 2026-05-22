import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import iconHome from '../img/icon_home.svg'
import iconSearch from '../img/icon_search.svg'
import iconCreate from '../img/icon_create.svg'
import iconFriends from '../img/icon_friends.svg'
import iconProfile from '../img/icon_profile.svg'
import iconHomeN from '../img/icon_home_n.svg'
import iconSearchN from '../img/icon_search_n.svg'
import iconCreateN from '../img/icon_create_n.svg'
import iconFriendsN from '../img/icon_friends_n.svg'
import iconProfileN from '../img/icon_profile_n.svg'
import { useTranslate } from '../services/useTranslate'

type Tab = {
  id: string
  to: string
  aria: string
  iconLight: string
  iconDark: string
}

const TABS: Tab[] = [
  { id: 'home', to: '/inicio', aria: 'Ir a Home', iconLight: iconHome, iconDark: iconHomeN },
  { id: 'search', to: '/buscar', aria: 'Buscar', iconLight: iconSearch, iconDark: iconSearchN },
  { id: 'create', to: '/capsulas/crear', aria: 'Crear capsula', iconLight: iconCreate, iconDark: iconCreateN },
  { id: 'friends', to: '/amigos', aria: 'Ir a Amigos', iconLight: iconFriends, iconDark: iconFriendsN },
  { id: 'profile', to: '/perfil', aria: 'Ir a Mi Perfil', iconLight: iconProfile, iconDark: iconProfileN },
]

const ACTIVE_KEY = 'app.bottomNav.active'

function isTabActive(id: string, pathname: string): boolean {
  switch (id) {
    case 'home': return pathname === '/inicio' || pathname === '/dashboard'
    case 'search': return pathname === '/buscar'
    case 'friends': return pathname.startsWith('/amigos')
    case 'profile': return pathname === '/perfil' || pathname === '/mis-capsulas' || pathname.startsWith('/ajustes')
    default: return false
  }
}

function AppBottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { tema } = useTema()
  const { t } = useTranslate()

  useEffect(() => {
    const current = sessionStorage.getItem(ACTIVE_KEY)
    if (!current) sessionStorage.setItem(ACTIVE_KEY, 'home')
  }, [])

  useEffect(() => {
    const pathname = location.pathname
    let matchedId: string | undefined
    if (pathname === '/inicio' || pathname === '/dashboard' || pathname === '/inicio-publico') matchedId = 'home'
    else if (pathname.startsWith('/ajustes')) matchedId = 'profile'
    else if (pathname.startsWith('/amigos')) matchedId = 'friends'
    else {
      const match = TABS.find((t) => t.to === pathname)
      if (match) matchedId = match.id
    }
    if (matchedId && matchedId !== 'create') {
      sessionStorage.setItem(ACTIVE_KEY, matchedId)
    }
  }, [location.pathname])

  const hidePaths = ['/', '/inicio-publico', '/registro', '/login', '/inicio-registro']
  const shouldHide =
    hidePaths.includes(location.pathname) ||
    location.pathname.startsWith('/capsulas/crear/')

  if (shouldHide) return null

  function onTabClick(tab: Tab) {
    if (tab.id === 'create') {
      navigate(tab.to)
      return
    }
    if (tab.id === 'home') {
      const isAuth = Boolean(sessionStorage.getItem('authToken'))
      const dest = isAuth ? '/inicio' : '/inicio-publico'
      sessionStorage.setItem(ACTIVE_KEY, 'home')
      navigate(dest)
      return
    }
    sessionStorage.setItem(ACTIVE_KEY, tab.id)
    navigate(tab.to)
  }

  const isDarkMode = tema === 'oscuro'

  return (
    <div className={`navbar-wrapper${isDarkMode ? ' navbar-wrapper--dark' : ''}`}>
      <nav className={`navbar-pill app-bottom-nav${isDarkMode ? ' app-bottom-nav--dark' : ''}`} role="navigation" aria-label={t('navHome')}>
        {TABS.map((tab) => {
          const isCreate = tab.id === 'create'
          const isActive = !isCreate && isTabActive(tab.id, location.pathname)
          const icon = isDarkMode ? tab.iconDark : tab.iconLight
          const ariaLabel =
            tab.id === 'home'
              ? t('navHome')
              : tab.id === 'search'
                ? t('navSearch')
                : tab.id === 'create'
                  ? t('navCreate')
                  : tab.id === 'friends'
                    ? t('navFriends')
                    : t('navProfile')

          if (isCreate) {
            return (
              <button
                key={tab.id}
                type="button"
                aria-label={ariaLabel}
                className="app-bottom-nav__item app-bottom-nav__item--create"
                onClick={() => onTabClick(tab)}
              >
                <img src={icon} alt="" width={20} height={20} aria-hidden="true" />
              </button>
            )
          }

          return (
            <button
              key={tab.id}
              type="button"
              aria-label={ariaLabel}
              className={`app-bottom-nav__item${isActive ? ' is-active' : ''}`}
              onClick={() => onTabClick(tab)}
            >
              <span className={`app-bottom-nav__icon-wrap${isActive ? ' is-active' : ''}`}>
                <img
                  src={icon}
                  alt=""
                  width={20}
                  height={20}
                  aria-hidden="true"
                  className={isActive ? 'app-bottom-nav__icon' : 'app-bottom-nav__icon app-bottom-nav__icon--inactive'}
                />
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default AppBottomNav
