import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import { logoMAsset } from '../img'
import { fetchCapsules, type ApiCapsule } from '../services/api.ts'
import { useTranslate } from '../services/useTranslate'

function CapsulesPage() {
  const navigate = useNavigate()
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const { t } = useTranslate()
  const [capsules, setCapsules] = useState<ApiCapsule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetchCapsules()
        setCapsules(response)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : t('loading')
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const ownCapsules = useMemo(() => capsules.slice(0, 6), [capsules])
  const recommendedCapsules = useMemo(() => capsules.slice(0, 3), [capsules])
  const friendCapsules = useMemo(() => capsules.filter((capsule) => (capsule.sharedWith?.length ?? 0) > 0).slice(0, 3), [capsules])

  return (
    <Fragment>
      <header className="mobile-header" aria-label={t('capsulesTitle')}>
        <button type="button" className="mobile-header__left" onClick={() => navigate(-1)} aria-label={t('backText')}>←</button>
        <Link to="/inicio" className="logo-button" aria-label={t('home')}>
          <img src={logo} alt="Momentum" />
        </Link>
        <span className="mobile-header__right" aria-hidden="true" />
      </header>
      <section className="page-layout page-layout--module">
      <article className="page-card">
        <h1>{t('capsulesTitle')}</h1>
        <p>{t('createCapsulesIntro')}</p>
        <div className="button-row">
          <Link to="/capsulas/crear" className="button-primary">{t('createCapsule')}</Link>
        </div>
      </article>

      {loading ? <p className="page-status">{t('loading')}</p> : null}
      {error ? <p className="page-status page-status--error">{error}</p> : null}

      <article className="page-card">
        <h2>{t('myCapsulesTitle')}</h2>
        <div className="capsule-list">
          {ownCapsules.length === 0 ? <p>{t('noCapsulesYet')}</p> : ownCapsules.map((capsule) => (
            <Link key={capsule._id} to={`/capsulas/${capsule._id}`} className="capsule-list__item capsule-list__item--link">
              <strong>{capsule.title}</strong>
              <span>{capsule.category || t('noCategory')}</span>
            </Link>
          ))}
        </div>
      </article>

      <article className="page-card">
        <h2>{t('recommendedCapsulesTitle')}</h2>
        <ul className="module-list">
          {recommendedCapsules.length === 0 ? <li>{t('noRecommendationsYet')}</li> : recommendedCapsules.map((capsule) => (
            <li key={`recommended-${capsule._id}`}>{capsule.title}</li>
          ))}
        </ul>
      </article>

      <article className="page-card">
        <h2>{t('friendCapsulesTitle')}</h2>
        <ul className="module-list">
          {friendCapsules.length === 0 ? <li>{t('noSharedCapsulesYet')}</li> : friendCapsules.map((capsule) => (
            <li key={`friend-${capsule._id}`}>{capsule.title}</li>
          ))}
        </ul>
      </article>
      </section>
    </Fragment>
  )
}

export default CapsulesPage
