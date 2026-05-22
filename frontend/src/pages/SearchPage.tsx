import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HeaderConAtras from '../components/HeaderConAtras'
import { useTranslate } from '../services/useTranslate'

type CategoryCard = {
  title: string
  icon: 'travel' | 'study' | 'friends' | 'empty'
}

const CATEGORIES: CategoryCard[] = [
  { title: 'Viajes', icon: 'travel' },
  { title: 'Estudio', icon: 'study' },
  { title: 'Amigos', icon: 'friends' },
  { title: 'Otros', icon: 'empty' },
]

function CategoryIcon({ icon }: { icon: CategoryCard['icon'] }) {
  if (icon === 'empty') return null

  if (icon === 'travel') {
    return (
      <svg className="search-screen__category-icon" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="17" y="10" width="22" height="34" rx="3" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M22 17h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M22 23h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M37 26l10-7 2 4-8 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M41 31l12-2-3 10-8 2-4-4z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="28" cy="48" r="2" fill="currentColor" />
      </svg>
    )
  }

  if (icon === 'study') {
    return (
      <svg className="search-screen__category-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M16 16h20v28H16z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M20 20h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20 26h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M38 28a9 9 0 1 1 9 9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="47" cy="38" r="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M47 43v6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg className="search-screen__category-icon" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M12 34l10-8 10 8-10 8-10-8z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M22 30l8-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 34l8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M40 22l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M41 21l10-3 3 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { t } = useTranslate()
  const categories = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        ...category,
        title:
          category.icon === 'travel'
            ? t('categoryTravel')
            : category.icon === 'study'
              ? t('categoryStudy')
              : category.icon === 'friends'
                ? t('categoryFriendship')
                : t('categoryOther'),
      })),
    [t],
  )

  return (
    <>
      <HeaderConAtras onAtras={() => navigate(-1)} />

      <section className="search-screen" aria-label={t('search')}>

      <section className="search-screen__search-bar" aria-label={t('searchByName')}>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('enterCapsuleName')}
          aria-label={t('enterCapsuleName')}
        />
        <button type="button">{t('search')}</button>
      </section>

      <p className="search-screen__help-text">{t('chooseCategory')}</p>

      <section className="search-screen__grid" aria-label={t('filterByCategory')}>
        {categories.map((category) => (
          <article key={category.title} className="search-screen__category">
            <h2>{category.title.toUpperCase()}</h2>
            <div className="search-screen__card">
              <div className="search-screen__placeholder">
                <CategoryIcon icon={category.icon} />
              </div>
            </div>
          </article>
        ))}
      </section>
    </section>
    </>
  )
}

export default SearchPage
