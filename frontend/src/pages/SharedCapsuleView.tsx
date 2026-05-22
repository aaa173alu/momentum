import { useEffect, useState, Fragment, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset } from '../img'
import { API_BASE_URL, fetchCapsuleById, getCapsuleThumb, type ApiCapsule } from '../services/api'
import { useTranslate } from '../services/useTranslate'
import '../styles/shared-capsule-view.css'
const SLIDE_REDUCTION = 92
const SLIDE_GAP = 12

function resolveUrl(url: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`
}

function SharedCapsuleView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const carouselRef = useRef<HTMLDivElement>(null)

  const [capsule, setCapsule] = useState<ApiCapsule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [slideIndex, setSlideIndex] = useState(0)
  const [slideWidth, setSlideWidth] = useState(0)

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    const measure = () => setSlideWidth(el.offsetWidth - SLIDE_REDUCTION)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading])

  useEffect(() => {
    if (!id) { setError(txt('ID de capsula no encontrado', 'Capsule ID not found')); setLoading(false); return }
    const token = sessionStorage.getItem('authToken')
    if (!token) { navigate('/login', { replace: true }); return }
    let active = true
    fetchCapsuleById(id)
      .then((data) => { if (active) { setCapsule(data); setLoading(false) } })
      .catch(() => { if (active) { setError(txt('No se pudo cargar la capsula', 'Could not load capsule')); setLoading(false) } })
    return () => { active = false }
  }, [id, navigate, language])

  const header = (
    <header className="mobile-header" aria-label={txt('Capsula compartida', 'Shared capsule')}>
      <button type="button" className="mobile-header__left" onClick={() => navigate(-1)} aria-label={txt('Volver', 'Back')}>←</button>
      <Link to="/inicio" className="logo-button" aria-label={txt('Ir a inicio', 'Go home')}>
        <img src={logo} alt="Momentum" />
      </Link>
      <span className="mobile-header__right" aria-hidden="true" />
    </header>
  )

  if (loading) return (
    <Fragment>
      {header}
      <section className="page-layout"><p>{txt('Cargando...', 'Loading...')}</p></section>
    </Fragment>
  )

  if (error || !capsule) return (
    <Fragment>
      {header}
      <section className="page-layout"><p>{error || txt('No se pudo cargar la capsula', 'Could not load capsule')}</p></section>
    </Fragment>
  )

  const { thumbnailUrl } = getCapsuleThumb(capsule)
  const owner = typeof capsule.owner === 'object' ? capsule.owner : null
  const ownerName = owner?.name ?? owner?.username ?? 'Desconocido'
  const ownerAvatar = owner?.avatar ?? null

  const mediaItems = (capsule.mediaItems ?? []).filter(
    (m) => m.type === 'image' || m.type === 'video'
  )
  const totalSlides = mediaItems.length

  const translateX = slideWidth > 0
    ? `${slideIndex * -(slideWidth + SLIDE_GAP)}px`
    : `calc(${slideIndex} * -1 * (min(100vw, 600px) - ${SLIDE_REDUCTION - SLIDE_GAP}px))`

  return (
    <Fragment>
      {header}

      <section className="scv-page">
        {/* Capsule thumbnail */}
        <div className="scv-thumb-wrap">
          {thumbnailUrl
            ? <img className="scv-thumb" src={resolveUrl(thumbnailUrl)} alt={capsule.title} />
            : <div className="scv-thumb scv-thumb--placeholder" aria-hidden="true">📦</div>
          }
        </div>

        {/* Title */}
        <h1 className="scv-title">{capsule.title}</h1>

        {/* Owner info */}
        <div className="scv-owner-section">
          <span className="scv-owner-label">{txt('CAPSULA CREADA POR', 'CAPSULE CREATED BY')}</span>
          <div className="scv-owner-row">
            <div className="scv-owner__avatar">
              {ownerAvatar
                ? <img src={resolveUrl(ownerAvatar)} alt={ownerName} />
                : <span>{ownerName.charAt(0).toUpperCase()}</span>}
            </div>
            <span className="scv-owner__name">{ownerName}</span>
          </div>
        </div>

        {/* Read-only carousel */}
        {mediaItems.length > 0 && (
          <div className="scv-carousel-wrap">
            <div className="scv-carousel-outer" ref={carouselRef}>
              <div
                className="scv-carousel-track"
                style={{ transform: `translateX(${translateX})` }}
              >
                {mediaItems.map((media, idx) => (
                  <div
                    key={media._id || idx}
                    className="scv-slide"
                    style={slideWidth > 0 ? { minWidth: slideWidth + 'px' } : undefined}
                  >
                    {media.type === 'video' ? (
                      <video src={resolveUrl(media.url)} className="scv-slide__media" controls />
                    ) : (
                      <img src={resolveUrl(media.url)} alt={`Slide ${idx + 1}`} className="scv-slide__media" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {totalSlides > 1 && (
              <div className="scv-carousel-controls">
                <button
                  type="button"
                  className="scv-carousel__arrow"
                  onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                  disabled={slideIndex === 0}
                  aria-label={txt('Anterior', 'Previous')}
                >‹</button>
                <div className="scv-dots">
                  {Array.from({ length: totalSlides }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`scv-dot${slideIndex === i ? ' scv-dot--active' : ''}`}
                      onClick={() => setSlideIndex(i)}
                      aria-label={`${txt('Ir a slide', 'Go to slide')} ${i + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="scv-carousel__arrow"
                  onClick={() => setSlideIndex((i) => Math.min(totalSlides - 1, i + 1))}
                  disabled={slideIndex >= totalSlides - 1}
                  aria-label={txt('Siguiente', 'Next')}
                >›</button>
              </div>
            )}
          </div>
        )}

        {/* Description (read-only) */}
        {capsule.description && (
          <div className="scv-description">
            <p className="scv-description__text">{capsule.description}</p>
          </div>
        )}

        {/* Accept button */}
        <button
          type="button"
          className="scv-accept-btn"
          onClick={() => navigate(`/capsulas/${id}/interior`)}
        >
          {txt('Aceptar', 'Accept')}
        </button>
      </section>
    </Fragment>
  )
}

export default SharedCapsuleView
