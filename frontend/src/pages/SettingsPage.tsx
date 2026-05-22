import { Link, useNavigate } from 'react-router-dom'
import HeaderConAtras from '../components/HeaderConAtras'
import { useTranslate } from '../services/useTranslate'

function SettingsPage() {
  const navigate = useNavigate()
  const { t } = useTranslate()

  return (
    <>
      <HeaderConAtras onAtras={() => navigate(-1)} />

      <section className="settings-mobile settings-mobile--menu" aria-label={t('settingsTitle')}>
        <h1 className="settings-title">{t('settingsTitle')}</h1>

        <div className="settings-menu settings-menu--lowered">
          <Link to="/ajustes/cuenta" className="settings-menu__item">{t('account')}</Link>
          <Link to="/ajustes/preferencias" className="settings-menu__item">{t('preferences')}</Link>
          <Link to="/ajustes/sesion" className="settings-menu__item">{t('sessionSecurity')}</Link>
        </div>
      </section>
    </>
  )
}

export default SettingsPage
