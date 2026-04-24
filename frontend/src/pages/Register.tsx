import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../services/api.ts'

function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim() || !email.trim() || !password || !repeatPassword) {
      setError('Completa todos los campos')
      return
    }

    if (password.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres')
      return
    }

    if (password !== repeatPassword) {
      setError('Las contrasenas no coinciden')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await registerUser(name.trim(), email.trim(), password)
      navigate('/login')
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Error en el registro'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-screen" aria-label="Pantalla de registro">
      <div className="auth-screen__brand" aria-hidden="true">M</div>
      <article className="auth-screen__card">
        <form className="auth-screen__form" onSubmit={handleSubmit}>
          <label className="field auth-field" htmlFor="register-name">
            <span>Nombre de usuario</span>
            <input
              id="register-name"
              name="name"
              type="text"
              placeholder="Inserte su nombre de usuario"
              autoComplete="username"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="field auth-field" htmlFor="register-email">
            <span>Correo electronico</span>
            <input
              id="register-email"
              name="email"
              type="email"
              placeholder="ejemplo@gmail.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="field auth-field" htmlFor="register-password">
            <span>Contrasena</span>
            <input
              id="register-password"
              name="password"
              type="password"
              placeholder="**********"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <label className="field auth-field" htmlFor="register-repeat-password">
            <span>Repetir contrasena</span>
            <input
              id="register-repeat-password"
              name="repeatPassword"
              type="password"
              placeholder="**********"
              autoComplete="new-password"
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
            />
          </label>

          <label className="field auth-field" htmlFor="register-photo">
            <span>Foto de usuario</span>
            <div className="auth-screen__file-wrap">
              <input id="register-photo" name="userPhoto" type="text" placeholder="Selecciona foto de usuario" readOnly />
              <span className="auth-screen__file-arrow">&gt;</span>
            </div>
          </label>

          {error ? <p className="auth-screen__error">{error}</p> : null}

          <div className="auth-screen__actions">
            <Link to="/" className="auth-screen__back" aria-label="Volver a inicio">←</Link>
            <button type="submit" className="auth-screen__submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </article>
    </section>
  )
}

export default Register