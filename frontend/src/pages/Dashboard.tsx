const stats = [
  { label: 'Capsulas totales', value: '24' },
  { label: 'Favoritas', value: '8' },
  { label: 'Compartidas', value: '5' },
]

const recentCapsules = [
  'Viaje a Lisboa',
  'Graduacion',
  'Playlist de verano',
]

function Dashboard() {
  return (
    <section className="page-layout">
      <div className="hero-panel">
        <h1>Dashboard</h1>
        <p>Vista general de actividad, recuerdos recientes y estado de tu coleccion.</p>
      </div>

      <div className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>

      <div className="panel-grid">
        <article className="panel">
          <h2>Ultimas capsulas</h2>
          <ul className="timeline">
            {recentCapsules.map((capsule) => (
              <li key={capsule}>{capsule}</li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <h2>Proxima accion</h2>
          <p>Sube una nueva capsula con fotos, texto y una fecha importante.</p>
        </article>
      </div>
    </section>
  )
}

export default Dashboard