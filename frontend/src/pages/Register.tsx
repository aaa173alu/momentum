import { type ChangeEvent, type FormEvent, useState } from 'react'
import userIcon from '../img/icon_user.svg'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { logoMAsset } from '../img'
function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [profilePhoto, setProfilePhoto] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setProfilePhoto('')
      setPhotoName('')
      setPhotoPreview('')
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten fotos (jpg, png, webp, etc.)')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La foto debe pesar menos de 5MB')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      setProfilePhoto(result)
      setPhotoPreview(result)
      setPhotoName(file.name)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim() || !email.trim() || !password || !repeatPassword) {
      setError('Completa todos los campos')
      return
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    if (password !== repeatPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const incomingState = (location as any).state as { inviteToken?: string } | null
      navigate('/registro/datos', {
        state: {
          name: name.trim(),
          email: email.trim(),
          password,
          avatar: profilePhoto || undefined,
          inviteToken: incomingState?.inviteToken,
        },
      })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Error en el registro'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <header className="mobile-header" aria-label="Encabezado">
        <Link to="/" className="mobile-header__back" aria-label="Volver a inicio">
          ←
        </Link>
        <button type="button" className="mobile-header__logo-button" aria-label="Ir a inicio">
          <img className="mobile-header__logo" src={logoMAsset} alt="Momentum" />
        </button>
        <span className="mobile-header__side" aria-hidden="true" />
      </header>

      <section className="auth-screen" aria-label="Pantalla de registro">
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
            <span>Contraseña</span>
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
            <span>Repetir contraseña</span>
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
            <input
              id="register-photo"
              name="userPhoto"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="auth-screen__file-input"
              style={{ display: 'none' }}
              aria-hidden="true"
            />
            <div className="auth-screen__file-row">
              <label htmlFor="register-photo" className="auth-screen__file-picker" role="button" tabIndex={0} aria-label={photoName ? 'Cambiar foto' : 'Seleccionar foto'}>
                <span>{photoName ? 'Cambiar foto' : 'Seleccionar foto'}</span>
                <span className="auth-screen__file-picker-arrow">&gt;</span>
              </label>

              <div className="auth-screen__avatar-preview" aria-hidden="true">
                {photoPreview ? (
                  <img src={photoPreview} alt="Vista previa de foto de perfil" className="auth-screen__avatar-image" />
                ) : (
                  <img src={userIcon} alt="Icono usuario" className="auth-screen__avatar-image" />
                )}
              </div>
            </div>

            <small className="auth-screen__file-hint">
              {photoName ? `Seleccionada: ${photoName}` : 'Elige una imagen para tu perfil'}
            </small>
          </label>

          {error ? <p className="auth-screen__error">{error}</p> : null}

          <div className="auth-screen__actions">
            <span className="mobile-header__side" aria-hidden="true" />
            <button type="submit" className="auth-screen__submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear cuenta'}
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

export default Register