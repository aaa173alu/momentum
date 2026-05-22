import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { fetchCapsules, getCapsuleThumb, type ApiCapsule } from '../services/api'
import { useTranslate } from '../services/useTranslate'
import { logoMAsset } from '../img'
import CapsulaThumb from '../components/CapsulaThumb'

export default function TodasMisCapsulas() {
  const navigate = useNavigate()
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const [capsulas, setCapsulas] = useState<ApiCapsule[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const data = await fetchCapsules()
        if (!active) return
        setCapsulas(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error('Error cargando cápsulas', e)
        setCapsulas([])
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [])

  const capsulasFiltradas = useMemo(() => {
    const q = String(busqueda || '').trim()
    if (q === '') return capsulas

    return capsulas.filter((c) => {
      const cat = (c.category as string) || (c as any).categoria || ''
      return String(cat).toLowerCase().includes(q.toLowerCase())
    })
  }, [capsulas, busqueda])

  const title = busqueda.trim() === '' ? txt('TODAS TUS CAPSULAS', 'ALL YOUR CAPSULES') : txt('TODOS LOS RESULTADOS', 'ALL RESULTS')

  return (
    <div className="todas-capsulas-page">
      <header className="mobile-header" aria-label={txt('Mis capsulas', 'My capsules')}>
        <button type="button" className="mobile-header__left" onClick={() => navigate(-1)} aria-label={txt('Volver atras', 'Go back')}>←</button>
        <a href="/inicio" className="logo-button" aria-label={txt('Ir a inicio', 'Go home')}>
          <img className="mobile-header__logo" src={logo} alt="Momentum" />
        </a>
        <span className="mobile-header__right" aria-hidden="true" />
      </header>

      <h2 className="todas-capsulas__title">{title}</h2>

      <div className={`todas-capsulas__search ${busqueda.trim() ? 'is-active' : ''}`}>
        <input
          className="todas-capsulas__input"
          placeholder={txt('Buscar por categoria', 'Search by category')}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label={txt('Buscar capsulas', 'Search capsules')}
        />
        {busqueda.trim() && (
          <button type="button" className="search-clear" onClick={() => setBusqueda('')} aria-label={txt('Limpiar busqueda', 'Clear search')}>×</button>
        )}
      </div>

      <main className="todas-capsulas__grid-wrap">
        {loading ? null : capsulasFiltradas.length === 0 ? (
          busqueda.trim() ? (
            <p className="todas-capsulas__empty">{txt(`No se encontraron capsulas en '${busqueda}'`, `No capsules found in '${busqueda}'`)}</p>
          ) : (
            <div className="todas-capsulas__empty">
              <p>{txt('Aun no tienes capsulas. Crea tu primera!', 'You have no capsules yet. Create your first one!')}</p>
              <button type="button" className="todas-capsulas__create" onClick={() => navigate('/crear-capsula')}>{txt('Crear capsula', 'Create capsule')}</button>
            </div>
          )
        ) : (
          <section className="todas-capsulas__grid">
            {capsulasFiltradas.map((capsula) => (
              <div
                key={capsula._id}
                className="todas-capsulas__cell"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/capsulas/${capsula._id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') navigate(`/capsulas/${capsula._id}`)
                }}
                aria-label={capsula.title || txt('Abrir capsula', 'Open capsule')}
              >
                <div className="thumb-wrap">
                  <div
                    className="thumb-halo"
                    style={{ background: `radial-gradient(circle, ${( (capsula as any).colorHalo || '#C8B89A')} 0%, transparent 70%)` }}
                    aria-hidden="true"
                  />

                  <div className="thumb-inner">
                    <CapsulaThumb
                      capsula={{ id: capsula._id, nombre: capsula.title || '', ...getCapsuleThumb(capsula) }}
                      onOpen={(id) => navigate(`/capsulas/${id}`)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  )
}
