function Register() {
  return (
    <section className="page-card form-card">
      <div>
        <h1>Crear cuenta</h1>
        <p>Empieza a construir tu biblioteca personal de recuerdos.</p>
      </div>

      <label className="field">
        <span>Nombre completo</span>
        <input type="text" placeholder="Tu nombre" />
      </label>

      <label className="field">
        <span>Correo electronico</span>
        <input type="email" placeholder="nombre@ejemplo.com" />
      </label>

      <label className="field">
        <span>Contrasena</span>
        <input type="password" placeholder="Minimo 8 caracteres" />
      </label>

      <div className="button-row">
        <button type="button" className="button-primary">Crear cuenta</button>
        <button type="button" className="button-secondary">Ya tengo cuenta</button>
      </div>
    </section>
  )
}

export default Register