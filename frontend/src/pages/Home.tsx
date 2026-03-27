function Home() {
  return (
    <section className="page-layout">
      <div className="hero-panel">
        <h1>Momentum by Looma</h1>
        <p>Explora tus capsulas de recuerdos y revive historias importantes cuando quieras.</p>
        <div className="button-row">
          <button type="button" className="button-primary">Explorar capsulas</button>
          <button type="button" className="button-secondary">Crear primera capsula</button>
        </div>
      </div>

      <div className="panel-grid">
        <article className="panel">
          <h2>Recuerdos organizados</h2>
          <p>Guarda fotos, mensajes, audio y contexto en un mismo lugar.</p>
        </article>
        <article className="panel">
          <h2>Linea temporal</h2>
          <p>Ordena tus momentos por fecha, tema o personas importantes.</p>
        </article>
        <article className="panel">
          <h2>Privado y personal</h2>
          <p>Decide que recuerdos son tuyos y cuales quieres compartir.</p>
        </article>
      </div>
    </section>
  )
}

export default Home