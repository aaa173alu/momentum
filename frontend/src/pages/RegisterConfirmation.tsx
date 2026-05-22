import { Link } from 'react-router-dom'
import { logoMAsset } from '../img'

function RegisterConfirmation() {
  return (
    <>
      <header className="mobile-header" aria-label="Encabezado">
        <span className="mobile-header__side" aria-hidden="true" />
        <button type="button" className="mobile-header__logo-button" aria-label="Ir a inicio">
          <img className="mobile-header__logo" src={logoMAsset} alt="Momentum" />
        </button>
        <span className="mobile-header__side" aria-hidden="true" />
      </header>

      <section className="auth-screen" aria-label="Confirmacion de registro">
        <article className="auth-screen__card page-card">
          <h1>Registro completado</h1>
          <p>Tu cuenta ya esta lista. Ahora puedes iniciar sesion en Momentum.</p>
          <div className="button-row">
            <Link to="/login" className="button-primary">Iniciar sesion</Link>
            <Link to="/inicio-publico" className="button-secondary">Volver al inicio</Link>
          </div>
        </article>
      </section>
    </>
  )
}

export default RegisterConfirmation
