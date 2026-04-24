import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/inicio-publico', label: 'Inicio', end: true },
  { to: '/login', label: 'Login' },
  { to: '/registro', label: 'Registro' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/capsula', label: 'Capsula' },
  { to: '/subir', label: 'Subir' },
]

function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__brand">Momentum</div>
      <nav className="navbar__menu" aria-label="Navegación principal">
        {navItems.map((item) => (
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
    </header>
  )
}

export default Navbar