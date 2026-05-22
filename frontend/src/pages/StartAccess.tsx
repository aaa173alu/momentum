import { Link } from 'react-router-dom'
import { logoMAsset } from '../img'
import { useTranslate } from '../services/useTranslate'

function StartAccess() {
  const { t } = useTranslate()

  return (
    <section className="onboarding-screen onboarding-screen--entry" aria-label={t('createAccount')}>
      <header className="mobile-header" aria-label={t('home')}>
        <span className="mobile-header__side" aria-hidden="true" />
        <button type="button" className="mobile-header__logo-button" aria-label={t('home')}>
          <img className="mobile-header__logo" src={logoMAsset} alt="Momentum" />
        </button>
        <span className="mobile-header__side" aria-hidden="true" />
      </header>

      <div className="onboarding-screen__entry-actions">
        <Link className="onboarding-screen__button onboarding-screen__button--light" to="/login">
          {t('signIn')}
        </Link>
        <Link className="onboarding-screen__button onboarding-screen__button--dark" to="/registro">
          {t('signUp')}
        </Link>
      </div>

      <div className="onboarding-screen__footer">
        <p>{t('captureMemoriesText')}</p>
        <img className="onboarding-screen__wordmark" src="/img/logo_looma.svg" alt="looma" />
      </div>
    </section>
  )
}

export default StartAccess
