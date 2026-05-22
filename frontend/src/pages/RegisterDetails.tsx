import { type FormEvent, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { registerUser, loginUser, acceptInvite } from '../services/api.ts'
import { logoMAsset } from '../img'

type RegisterDraft = {
  name: string
  email: string
  password: string
  avatar?: string
}

function RegisterDetails() {
  const navigate = useNavigate()
  const location = useLocation()
  const draft = useMemo(() => (location.state as RegisterDraft | null), [location.state])

  const [birthDate, setBirthDate] = useState('')
  const [country, setCountry] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_say'>('prefer_not_say')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const hasDraft = Boolean(draft?.name && draft?.email && draft?.password)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft) {
      setError('Vuelve al primer paso del registro')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
        await registerUser(
        draft.name,
        draft.email,
        draft.password,
        draft.avatar,
        {
          birthDate: birthDate || undefined,
          country: country.trim() || undefined,
          gender,
        },
      )
      // Auto-login after successful registration
      try {
        const resp = await loginUser(draft.email, draft.password)
        sessionStorage.setItem('authToken', resp.token)
        if (resp.refreshToken) sessionStorage.setItem('refreshToken', resp.refreshToken)
        sessionStorage.setItem('authUser', JSON.stringify(resp.user))
        window.dispatchEvent(new Event('authUserChanged'))

        // If there is an inviteToken in the draft, accept it now
        const inviteToken = (draft as any).inviteToken
        if (inviteToken) {
          try {
            await acceptInvite(inviteToken)
          } catch (e) {
            // ignore invite accept errors for now
          }
        }

        navigate('/registro/confirmacion')
      } catch (loginErr) {
        // If login failed, still go to confirmation page
        navigate('/registro/confirmacion')
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'No se pudo completar el registro'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!hasDraft) {
    return (
      <>
        <header className="mobile-header" aria-label="Encabezado">
          <span className="mobile-header__side" aria-hidden="true" />
          <button type="button" className="mobile-header__logo-button" aria-label="Ir a inicio">
            <img className="mobile-header__logo" src={logoMAsset} alt="Momentum" />
          </button>
          <span className="mobile-header__side" aria-hidden="true" />
        </header>

        <section className="auth-screen" aria-label="Datos adicionales de registro">
          <article className="auth-screen__card page-card">
            <h1>Falta informacion del paso anterior</h1>
            <p>Para continuar, completa primero tu nombre, email y contrasena.</p>
            <div className="button-row">
              <Link to="/registro" className="button-secondary">Volver al registro</Link>
            </div>
          </article>
        </section>
      </>
    )
  }

  return (
    <>
      <header className="mobile-header" aria-label="Encabezado">
        <Link to="/registro" className="mobile-header__back" aria-label="Volver a registro">
          ←
        </Link>
        <button type="button" className="mobile-header__logo-button" aria-label="Ir a inicio">
          <img className="mobile-header__logo" src={logoMAsset} alt="Momentum" />
        </button>
        <span className="mobile-header__side" aria-hidden="true" />
      </header>

      <section className="auth-screen" aria-label="Datos adicionales de registro">
      <article className="auth-screen__card">
        <form className="auth-screen__form" onSubmit={handleSubmit}>
          <h1>Datos adicionales</h1>
          <p>Ultimo paso para crear tu cuenta.</p>

          <label className="field auth-field" htmlFor="register-birthDate">
            <span>Fecha de nacimiento</span>
            <input
              id="register-birthDate"
              name="birthDate"
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
          </label>

          <label className="field auth-field" htmlFor="register-country">
            <span>Pais</span>
            <input
              id="register-country"
              name="country"
              type="text"
              placeholder="Tu pais"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            />
          </label>

          <label className="field auth-field" htmlFor="register-gender">
            <span>Sexo</span>
            <select
              id="register-gender"
              name="gender"
              value={gender}
              onChange={(event) => setGender(event.target.value as 'male' | 'female' | 'other' | 'prefer_not_say')}
            >
              <option value="prefer_not_say">Prefiero no decirlo</option>
              <option value="female">Mujer</option>
              <option value="male">Hombre</option>
              <option value="other">Otro</option>
            </select>
          </label>

          {error ? <p className="auth-screen__error">{error}</p> : null}

          <div className="auth-screen__actions">
            <span className="mobile-header__side" aria-hidden="true" />
            <button type="submit" className="auth-screen__submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Finalizar registro'}
            </button>
          </div>
        </form>
      </article>
    </section>
    </>
  )
}

export default RegisterDetails
