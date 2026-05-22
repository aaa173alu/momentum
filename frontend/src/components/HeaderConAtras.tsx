import { Link, useNavigate } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset } from '../img'
import { useTranslate } from '../services/useTranslate'

type HeaderConAtrasProps = {
  onAtras?: () => void
}

function HeaderConAtras({ onAtras }: HeaderConAtrasProps) {
  const navigate = useNavigate()
  const { t } = useTranslate()
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const handleAtras = onAtras ?? (() => navigate(-1))

  return (
    <header className="header-con-atras" aria-label="Encabezado interior">
      <button type="button" className="header-con-atras__back" onClick={handleAtras} aria-label={t('backText')}>
        <span className="header-con-atras__back-arrow" aria-hidden="true">←</span>
        <span className="header-con-atras__back-text">{t('backText')}</span>
      </button>

      <Link to="/" className="header-con-atras__logo-button" aria-label={t('home')}>
        <img className="header-con-atras__logo" src={logo} alt="Momentum" />
      </Link>
    </header>
  )
}

export default HeaderConAtras
