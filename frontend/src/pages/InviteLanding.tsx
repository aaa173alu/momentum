import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getInvite, acceptInvite } from '../services/api'
import { useTranslate } from '../services/useTranslate'

function InviteLanding() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<{ capsuleId: string; title: string; role: string } | null>(null)

  useEffect(() => {
    let active = true
    if (!token) { setError(txt('Invitacion invalida', 'Invalid invite')); setLoading(false); return }
    getInvite(token)
      .then((data) => { if (active) setInfo(data) })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Error') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, language])

  const handleRegister = () => {
    navigate('/registro', { state: { inviteToken: token } })
  }

  const handleLogin = () => {
    navigate('/login', { state: { redirectTo: `/invite/${token}` } })
  }

  const handleAccept = async () => {
    if (!token) return
    try {
      setLoading(true)
      await acceptInvite(token)
      navigate('/mis-capsulas')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error accepting invite')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <section className="page-layout"><p>{txt('Cargando...', 'Loading...')}</p></section>
  if (error) return <section className="page-layout"><p>{error}</p></section>

  return (
    <section className="page-layout">
      <h1>{txt('Invitacion a capsula', 'Capsule invitation')}</h1>
      {info ? (
        <>
          <p>{txt('Has sido invitado a la capsula:', 'You were invited to the capsule:')} <strong>{info.title}</strong></p>
          <p>{txt('Rol asignado:', 'Assigned role:')} {info.role}</p>
          {sessionStorage.getItem('authToken') ? (
            <button onClick={handleAccept}>{txt('Aceptar invitacion', 'Accept invitation')}</button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleRegister}>{txt('Registrarme y aceptar', 'Register and accept')}</button>
              <button onClick={handleLogin}>{txt('Iniciar sesion', 'Log in')}</button>
            </div>
          )}
        </>
      ) : (
        <p>{txt('Invitacion no valida', 'Invalid invite')}</p>
      )}
    </section>
  )
}

export default InviteLanding
