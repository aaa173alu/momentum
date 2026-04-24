import { Model3DViewer } from '../3d/Model3DViewer'

function CapsuleView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', gap: '20px', padding: '20px', boxSizing: 'border-box' }}>
      {/* Encabezado */}
      <section className="page-layout">
        <article className="page-card">
          <div className="capsule-header">
            <div>
              <h1>Viaje a Lisboa</h1>
              <p>Una capsula dedicada a los mejores momentos del viaje de verano.</p>
            </div>
            <div className="capsule-meta">
              <span>12 agosto 2025</span>
              <span>4 fotos</span>
              <span>2 audios</span>
            </div>
          </div>
        </article>
      </section>

      {/* Visualizador 3D */}
      <div style={{ flex: 1, border: '2px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
        <Model3DViewer 
          modelPath="/3d/statue of liberty 3d model.glb"
          backgroundColor="#f5f5f5"
        />
      </div>
    </div>
  )
}

function CapsuleViewOld() {
  return (
    <section className="page-layout">
      <article className="page-card">
        <div className="capsule-header">
          <div>
            <h1>Viaje a Lisboa</h1>
            <p>Una capsula dedicada a los mejores momentos del viaje de verano.</p>
          </div>
          <div className="capsule-meta">
            <span>12 agosto 2025</span>
            <span>4 fotos</span>
            <span>2 audios</span>
          </div>
        </div>
      </article>

      <article className="panel">
        <h2>Historia</h2>
        <p className="capsule-story">
          Paseamos por Alfama, grabamos sonidos de la calle y cerramos el dia viendo el atardecer
          desde un mirador. Esta capsula guarda esos detalles para volver a ellos mas adelante.
        </p>
      </article>

      <div className="panel-grid">
        <article className="panel">
          <h2>Contenido</h2>
          <ul className="timeline">
            <li>Galeria de fotos destacadas</li>
            <li>Nota personal del viaje</li>
            <li>Audio ambiente de la ciudad</li>
          </ul>
        </article>
        <article className="panel">
          <h2>Etiquetas</h2>
          <p>viaje, verano, amigos, portugal</p>
        </article>
      </div>
    </section>
  )
}

export default CapsuleView