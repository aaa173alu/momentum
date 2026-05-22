import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset } from '../img'
import iconTrip from '../img/icon_trip.svg'
import iconTripN from '../img/icon_trip_n.svg'
import iconFamily from '../img/icon_family.svg'
import iconFamilyN from '../img/icon_family_n.svg'
import iconLove from '../img/icon_love.svg'
import iconLoveN from '../img/icon_love_n.svg'
import iconWork from '../img/icon_work.svg'
import iconWorkN from '../img/icon_work_n.svg'
import iconExpand from '../img/icon_expand_n.svg'
import CapsulaThumb from '../components/CapsulaThumb'
import { API_BASE_URL, getCapsuleThumb, type ApiCapsule } from '../services/api'
import { useTranslate } from '../services/useTranslate'

interface Categoria {
  label: string
  valor: string
  icono: string
  iconoN?: string
}

const categorias: Categoria[] = [
  { label: 'VIAJES', valor: 'viajes', icono: iconTrip, iconoN: iconTripN },
  { label: 'ESTUDIO', valor: 'estudio', icono: iconWork, iconoN: iconWorkN },
  { label: 'AMIGOS', valor: 'amigos', icono: iconLove, iconoN: iconLoveN },
  { label: 'FAMILIA', valor: 'familia', icono: iconFamily, iconoN: iconFamilyN },
  { label: 'OTROS', valor: 'otros', icono: iconExpand, iconoN: iconExpand },
]

export default function Busqueda() {
  const location = useLocation()
  const navigate = useNavigate()
  const { tema } = useTema()
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)

  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset

  // inputQuery: lo que el usuario escribe en el input (no lanza búsqueda automática)
  const [inputQuery, setInputQuery] = useState('')
  const [resultados, setResultados] = useState<ApiCapsule[]>([])
  const [buscando, setBuscando] = useState(false)
  const token = sessionStorage.getItem('authToken')

  // Los filtros activos se derivan siempre de la URL, no del input
  const urlParams = new URLSearchParams(location.search)
  const activeQ = urlParams.get('q')?.trim() ?? ''
  const rawCategory = urlParams.get('category')?.toLowerCase() ?? ''
  const activeCategory = categorias.some((c) => c.valor === rawCategory) ? rawCategory : ''
  const hayFiltro = activeQ !== '' || activeCategory !== ''
  const categoriaLabel = categorias.find((c) => c.valor === activeCategory)?.label

  const categoriasUi: Categoria[] = [
    { label: txt('VIAJES', 'TRAVEL'), valor: 'viajes', icono: iconTrip, iconoN: iconTripN },
    { label: txt('ESTUDIO', 'STUDY'), valor: 'estudio', icono: iconTrip, iconoN: iconTripN },
    { label: txt('AMIGOS', 'FRIENDS'), valor: 'amigos', icono: iconLove, iconoN: iconLoveN },
    { label: txt('FAMILIA', 'FAMILY'), valor: 'familia', icono: iconFamily, iconoN: iconFamilyN },
    { label: txt('OTROS', 'OTHER'), valor: 'otros', icono: iconWork, iconoN: iconWorkN },
  ]

  // Sincronizar el input con el param q de la URL (al navegar de vuelta etc.)
  useEffect(() => {
    setInputQuery(urlParams.get('q')?.trim() ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  // Buscar solo cuando cambia la URL (no al escribir)
  useEffect(() => {
    if (!token) return
    if (!hayFiltro) {
      setResultados([])
      return
    }
    setBuscando(true)
    const params = new URLSearchParams()
    if (activeQ) params.set('q', activeQ)
    if (activeCategory) params.set('category', activeCategory)
    fetch(`${API_BASE_URL}/api/capsules?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setResultados(Array.isArray(data) ? data : []))
      .catch(() => setResultados([]))
      .finally(() => setBuscando(false))
  }, [activeQ, activeCategory, token, hayFiltro])

  function handleBuscar() {
    const q = inputQuery.trim()
    if (q) {
      navigate(`/buscar?q=${encodeURIComponent(q)}`)
    }
  }

  function handleCategoriaClick(valor: string) {
    navigate(`/buscar?category=${encodeURIComponent(valor)}`)
  }

  return (
    <div className="busqueda-page">
      <header className="mobile-header" aria-label={txt('Búsqueda', 'Search')}>
        {hayFiltro ? (
          <button
            type="button"
            className="mobile-header__left"
            onClick={() => navigate('/buscar')}
            aria-label={txt('Volver a búsqueda', 'Back to search')}
          >
            ←
          </button>
        ) : (
          <span className="mobile-header__left" aria-hidden="true" />
        )}
        <button
          type="button"
          className="logo-button"
          aria-label={txt('Ir a inicio', 'Go home')}
          onClick={() => navigate('/inicio')}
        >
          <img className="mobile-header__logo" src={logo} alt="Momentum" />
        </button>
        <span className="mobile-header__right" aria-hidden="true" />
      </header>

      <h2 className="busqueda__title">
        {hayFiltro ? txt('RESULTADOS', 'RESULTS') : txt('BÚSQUEDA', 'SEARCH')}
      </h2>

      {/* Input siempre visible — solo se oculta cuando hay filtro de categoría activo sin texto */}
      {!activeCategory && (
        <div className="busqueda__search-wrapper">
          <div className="busqueda__search-row">
            <input
              className="busqueda__input"
              type="text"
              placeholder={txt('Introduce el nombre de la cápsula', 'Enter the capsule name')}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              aria-label={txt('Buscar cápsulas', 'Search capsules')}
            />
            {inputQuery && (
              <button
                type="button"
                className="busqueda__clear-btn"
                onClick={() => { setInputQuery(''); if (hayFiltro) navigate('/buscar') }}
                aria-label={txt('Limpiar texto', 'Clear text')}
              >
                ×
              </button>
            )}
            <button
              type="button"
              className="busqueda__buscar-btn"
              onClick={handleBuscar}
            >
              {txt('Buscar', 'Search')}
            </button>
          </div>
        </div>
      )}

      {/* Pill de categoría activa */}
      {activeCategory && (
        <div className="busqueda__pill-container">
          <div className="pill-categoria">
            <span>{categoriaLabel}</span>
            <button
              type="button"
              className="pill-categoria__close"
              onClick={() => navigate('/buscar')}
              aria-label={`${txt('Quitar filtro', 'Remove filter')} ${categoriaLabel}`}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Grid de categorías: solo cuando no hay filtro activo */}
      {!hayFiltro && (
        <div className="busqueda__categorias-wrap">
          <p className="busqueda__categorias-hint">{txt('Elige una categoría y encuentra tu cápsula', 'Choose a category and find your capsule')}</p>
          <div className="busqueda__categorias-grid">
            {categoriasUi.map((cat) => (
              <button
                key={cat.valor}
                type="button"
                className="busqueda__categoria-card"
                onClick={() => handleCategoriaClick(cat.valor)}
                aria-label={`${txt('Filtrar por', 'Filter by')} ${cat.label}`}
              >
                <div className="busqueda__categoria-icono">
                  <img src={tema === 'oscuro' ? cat.icono : (cat.iconoN ?? cat.icono)} alt="" width={32} height={32} aria-hidden="true" />
                </div>
                <span className="busqueda__categoria-nombre">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resultados */}
      {hayFiltro && (
        <div className="busqueda__resultados-wrap">
          {buscando ? (
            <div className="busqueda__resultados-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="busqueda__skeleton">
                  <div className="busqueda__skeleton-circle" />
                </div>
              ))}
            </div>
          ) : resultados.length > 0 ? (
            <section className="busqueda__resultados-grid">
              {resultados.map((capsula) => (
                <div
                  key={capsula._id}
                  className="busqueda__cell"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/capsulas/${capsula._id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigate(`/capsulas/${capsula._id}`)
                  }}
                  aria-label={capsula.title || txt('Abrir cápsula', 'Open capsule')}
                >
                  <div className="thumb-wrap">
                    <div
                      className="thumb-halo"
                      style={{
                        background: `radial-gradient(circle, ${(capsula as any).colorHalo || '#C8B89A'} 0%, transparent 70%)`,
                      }}
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
          ) : (
            <p className="busqueda__no-results">
              {txt('No se encontraron cápsulas', 'No capsules found')}
              {activeQ && ` para "${activeQ}"`}
              {activeCategory && categoriaLabel && ` ${txt('en', 'in')} ${categoriaLabel}`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
