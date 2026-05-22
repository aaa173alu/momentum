import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { loginUser } from '../services/api'
import { logoMAsset } from '../img'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await loginUser(identifier, password)
      sessionStorage.setItem('authToken', response.token)
      if (response.refreshToken) {
        sessionStorage.setItem('refreshToken', response.refreshToken)
      }
      sessionStorage.setItem('authUser', JSON.stringify(response.user))
      window.dispatchEvent(new Event('authUserChanged'))
      // respect redirectTo from location.state if present
      const state = (location as any).state as { redirectTo?: string } | null
      const redirectTo = state?.redirectTo
      navigate(redirectTo || '/inicio')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header className="mobile-header" aria-label="Encabezado">
        <Link to="/inicio-registro" className="mobile-header__back" aria-label="Volver a inicio">
          ←
        </Link>
        <button type="button" className="mobile-header__logo-button" aria-label="Ir a inicio">
          <img className="mobile-header__logo" src={logoMAsset} alt="Momentum" />
        </button>
        <span className="mobile-header__side" aria-hidden="true" />
      </header>

      <section className="auth-screen" aria-label="Pantalla de inicio de sesión">
        <article className="auth-screen__card">
        <form className="auth-screen__form" onSubmit={handleLogin}>
          <label className="field auth-field" htmlFor="login-identifier">
            <span>Correo o nombre de usuario</span>
            <input
              id="login-identifier"
              name="identifier"
              type="text"
              placeholder="ejemplo@gmail.com o usuario"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </label>

          <label className="field auth-field" htmlFor="login-password">
            <span>Contraseña</span>
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="**********"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button type="button" className="auth-screen__forgot">
            He olvidado mi contraseña
          </button>

          {error ? <p className="auth-screen__error">{error}</p> : null}

          <div className="auth-screen__actions">
            <span className="mobile-header__side" aria-hidden="true" />

            <button type="submit" className="auth-screen__submit" disabled={loading}>
              {loading ? 'Accediendo...' : 'Acceder'}
            </button>
          </div>
        </form>

        <div className="auth-screen__footer">
          <p>Captura tus recuerdos</p>
          <img className="auth-screen__looma-logo" src="/img/logo_looma.svg" alt="looma" />
        </div>
      </article>
    </section>
    </>
  )
}

export default Login