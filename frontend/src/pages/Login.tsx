import { Link } from 'react-router-dom'

function Login() {
  return (
    <section className="auth-screen" aria-label="Pantalla de inicio de sesion">
      <div className="auth-screen__brand" aria-hidden="true">M</div>
      <article className="auth-screen__card">

        <form className="auth-screen__form" action="#" method="post">
          <label className="field auth-field" htmlFor="login-email">
            <span>Correo electronico</span>
            <input id="login-email" name="email" type="email" placeholder="ejemplo@gmail.com" autoComplete="email" />
          </label>

          <label className="field auth-field" htmlFor="login-password">
            <span>Contrasena</span>
            <input id="login-password" name="password" type="password" placeholder="**********" autoComplete="current-password" />
          </label>

          <button type="button" className="auth-screen__forgot">He olvidado mi contrasena</button>

          <div className="auth-screen__actions">
            <Link to="/" className="auth-screen__back" aria-label="Volver a inicio">←</Link>
            <button type="submit" className="auth-screen__submit">Acceder</button>
          </div>
        </form>
      </article>
    </section>
  )
}

export default Login