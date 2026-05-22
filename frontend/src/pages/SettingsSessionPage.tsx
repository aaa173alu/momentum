import { Fragment, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import HeaderConAtras from '../components/HeaderConAtras'
import ModalCerrarSesion from '../components/ModalCerrarSesion'
import { clearSession, logoutUser } from '../services/api.ts'
import { useTranslate } from '../services/useTranslate'

function SettingsSessionPage() {
  const navigate = useNavigate()
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    setMessage('')
    setError('')

    try {
      await logoutUser()
      clearSession()
      navigate('/login')
    } catch (logoutError) {
      const detail = logoutError instanceof Error ? logoutError.message : txt('No se pudo cerrar sesion', 'Could not log out')
      setError(detail)
    } finally {
      setLoading(false)
      setShowLogoutModal(false)
    }
  }

  return (
    <Fragment>
      <HeaderConAtras onAtras={() => navigate(-1)} />
      <section className="settings-mobile settings-mobile--session" aria-label={txt('Sesion y seguridad', 'Session and security')}>

      <h1 className="settings-title">{txt('SESION Y SEGURIDAD', 'SESSION AND SECURITY')}</h1>

      <div className="settings-form settings-form--spacious settings-form--session-lowered">
        <button type="button" className="settings-btn settings-btn--danger settings-btn--full" onClick={() => setShowLogoutModal(true)}>
          {txt('CERRAR SESION', 'LOG OUT')}
        </button>

        <Link to="/ajustes/cuenta" className="settings-btn settings-btn--ghost settings-btn--full settings-link-btn">
          {txt('GESTIONAR ELIMINACION DE CUENTA', 'MANAGE ACCOUNT DELETION')}
        </Link>

        {message ? <p className="settings-success">{message}</p> : null}
        {error ? <p className="settings-error">{error}</p> : null}
      </div>

      <ModalCerrarSesion
        show={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        loading={loading}
      />
      </section>
    </Fragment>
  )
}

export default SettingsSessionPage
