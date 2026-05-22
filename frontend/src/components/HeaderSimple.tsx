import { Link } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset } from '../img'

function HeaderSimple() {
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset

  return (
    <header className="header-simple" aria-label="Encabezado simple">
      <Link to="/inicio" className="header-simple__logo-button" aria-label="Ir a Home">
        <img className="header-simple__logo" src={logo} alt="Momentum" />
      </Link>
    </header>
  )
}

export default HeaderSimple
