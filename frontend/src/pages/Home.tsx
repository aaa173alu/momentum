import { useNavigate } from 'react-router-dom'

function Home() {
  const navigate = useNavigate()

  return (
    <section className="page-layout">
      <div className="hero-panel">
        <h1>Bienvenido a Momentum</h1>
        <p>Captura tus recuerdos en capsulas, compartelos con tus amigos o quedatelos para ti.</p>
        <p>Puedes acceder a ellos cuando quieras y traerlos al futuro.</p>
        <div className="button-row">
          <button type="button" className="button-primary" onClick={() => navigate('/login')}>Inicia sesion</button>
          <button type="button" className="button-secondary" onClick={() => navigate('/registro')}>Registrate</button>
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