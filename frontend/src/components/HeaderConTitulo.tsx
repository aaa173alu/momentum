import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset } from '../img'

type HeaderConTituloProps = {
  titulo: string
  iconoDerecha: ReactNode
  onIconoDerecha: () => void
}

function HeaderConTitulo({ titulo, iconoDerecha, onIconoDerecha }: HeaderConTituloProps) {
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset

  return (
    <header className="header-con-titulo" aria-label={titulo}>
      <h1 className="header-con-titulo__title">{titulo.toUpperCase()}</h1>

      <Link to="/inicio" className="header-con-titulo__logo-button" aria-label="Ir a Home">
        <img className="header-con-titulo__logo" src={logo} alt="Momentum" />
      </Link>

      <button type="button" className="header-con-titulo__icon-button" onClick={onIconoDerecha} aria-label={`${titulo} acciones`}>
        {iconoDerecha}
      </button>
    </header>
  )
}

export default HeaderConTitulo
