import { Link } from 'react-router-dom'

function Register() {
  return (
    <section className="auth-screen" aria-label="Pantalla de registro">
      <div className="auth-screen__brand" aria-hidden="true">M</div>
      <article className="auth-screen__card">
        <form className="auth-screen__form" action="#" method="post">
          <label className="field auth-field" htmlFor="register-name">
            <span>Nombre de usuario</span>
            <input id="register-name" name="userName" type="text" placeholder="Inserte su nombre de usuario" autoComplete="username" />
          </label>

          <label className="field auth-field" htmlFor="register-email">
            <span>Correo electronico</span>
            <input id="register-email" name="email" type="email" placeholder="ejemplo@gmail.com" autoComplete="email" />
          </label>

          <label className="field auth-field" htmlFor="register-password">
            <span>Contrasena</span>
            <input id="register-password" name="password" type="password" placeholder="**********" autoComplete="new-password" />
          </label>

          <label className="field auth-field" htmlFor="register-repeat-password">
            <span>Repetir contrasena</span>
            <input id="register-repeat-password" name="repeatPassword" type="password" placeholder="**********" autoComplete="new-password" />
          </label>

          <label className="field auth-field" htmlFor="register-photo">
            <span>Foto de usuario</span>
            <div className="auth-screen__file-wrap">
              <input id="register-photo" name="userPhoto" type="text" placeholder="Selecciona foto de usuario" readOnly />
              <span className="auth-screen__file-arrow">&gt;</span>
            </div>
          </label>

          <div className="auth-screen__actions">
            <Link to="/" className="auth-screen__back" aria-label="Volver a inicio">←</Link>
            <button type="submit" className="auth-screen__submit">Acceder</button>
          </div>
        </form>
      </article>
    </section>
  )
}

export default Register