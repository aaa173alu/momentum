function Login() {
  return (
    <section className="page-card form-card">
      <div>
        <h1>Iniciar sesion</h1>
        <p>Accede a tus capsulas y continua donde lo dejaste.</p>
      </div>

      <label className="field">
        <span>Correo electronico</span>
        <input type="email" placeholder="nombre@ejemplo.com" />
      </label>

      <label className="field">
        <span>Contrasena</span>
        <input type="password" placeholder="Introduce tu contrasena" />
      </label>

      <div className="button-row">
        <button type="button" className="button-primary">Entrar</button>
        <button type="button" className="button-secondary">Recuperar acceso</button>
      </div>
    </section>
  )
}

export default Login