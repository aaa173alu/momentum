import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import NotificationBell from './NotificationBell.tsx'
import { clearSession, fetchCurrentUser, logoutUser, type ApiUser } from '../services/api.ts'

const publicNavItems = [
  { to: '/inicio-publico', label: 'Inicio', end: true },
  { to: '/login', label: 'Login' },
  { to: '/registro', label: 'Registro' },
]

const privateNavItems = [
  { to: '/capsula', label: 'Capsula' },
  { to: '/subir', label: 'Subir' },
]

type NavItem = {
  to: string
  label: string
  end?: boolean
}

function Navbar() {
  const navigate = useNavigate()
  const token = localStorage.getItem('authToken')
  const [user, setUser] = useState<ApiUser | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }

    const loadUser = async () => {
      setLoadingUser(true)

      try {
        const currentUser = await fetchCurrentUser()
        setUser(currentUser)
      } catch {
        setUser(null)
      } finally {
        setLoadingUser(false)
      }
    }

    loadUser()
  }, [token])

  async function handleLogout() {
    try {
      await logoutUser()
    } catch {
      // Ignore logout errors, local session still gets cleared.
    } finally {
      clearSession()
      setUser(null)
      navigate('/login')
    }
  }

  return (
    <header className="navbar">
      <div className="navbar__side navbar__side--left">
        <nav className="navbar__menu" aria-label="Navegación principal">
          {(token ? privateNavItems : publicNavItems).map((item: NavItem) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `navbar__item ${isActive ? 'is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <NavLink to={token ? '/inicio' : '/login'} className="navbar__center-btn" aria-label="Ir a inicio">
        <span className="navbar__center-btn-circle">M</span>
      </NavLink>

      <div className="navbar__side navbar__side--right">
        {token && user ? <span className="navbar__user">{user.name}</span> : null}
        {token ? (
          <>
            <NotificationBell token={token} />
            <button type="button" className="navbar__logout" onClick={handleLogout}>
              {loadingUser ? '...' : 'Salir'}
            </button>
          </>
        ) : null}
      </div>
    </header>
  )
}

export default Navbar