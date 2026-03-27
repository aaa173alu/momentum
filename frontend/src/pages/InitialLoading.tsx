function InitialLoading() {
  return (
    <section className="initial-loading" aria-label="Pantalla de carga inicial">
      <div className="initial-loading__card">
        <span className="initial-loading__badge">Momentum</span>
        <h1>Preparando tu espacio</h1>
        <p>Estamos cargando tu experiencia para que puedas entrar a tus capsulas.</p>
        <div className="initial-loading__progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  )
}

export default InitialLoading