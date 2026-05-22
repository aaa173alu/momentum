import { Link } from 'react-router-dom'
import HeaderSimple from '../components/HeaderSimple'
import { useEffect, useState } from 'react'

function Home() {
  const [lang, setLang] = useState<'es' | 'en'>('es')

  useEffect(() => {
    function updateLang() {
      try {
        const raw = sessionStorage.getItem('authUser')
        if (!raw) {
          setLang('es')
          return
        }
        const parsed = JSON.parse(raw) as { preferences?: { language?: string } }
        setLang(parsed.preferences?.language === 'en' ? 'en' : 'es')
      } catch (e) {
        setLang('es')
      }
    }

    updateLang()
    window.addEventListener('authUserChanged', updateLang)
    window.addEventListener('storage', updateLang)
    return () => {
      window.removeEventListener('authUserChanged', updateLang)
      window.removeEventListener('storage', updateLang)
    }
  }, [])

  return (
    <div className="home-public-page">
      <HeaderSimple />
      <section className="onboarding-screen onboarding-screen--welcome" aria-label={lang === 'en' ? 'Welcome screen' : 'Pantalla de bienvenida'}>
        <div className="onboarding-screen__welcome-copy">
          <h1>{lang === 'en' ? 'WELCOME TO MOMENTUM' : 'BIENVENIDO A MOMENTUM'}</h1>
          <p>
            {lang === 'en' ? (
              <>Capture your memories in capsules,<br />share them with your friends or<br />keep them for yourself.</>
            ) : (
              <>
                Captura tus recuerdos en cápsulas,
                <br />
                compártelas con tus amigos o
                <br />
                quédatelas para ti solo.
              </>
            )}
          </p>
          <p>
            {lang === 'en' ? (
              <>You can access them whenever you want, you may also save them<br />and bring them back in the future.</>
            ) : (
              <>
                Puedes acceder a ellas cuando quieras, también puedes guardarlas
                <br />
                y traerlas en el futuro.
              </>
            )}
          </p>
        </div>

        <div className="home-public-bottom">
          <img className="onboarding-screen__wordmark" src="/img/logo_looma.svg" alt="looma" />
          <Link className="onboarding-screen__cta" to="/inicio-registro">
            {lang === 'en' ? 'Sign in to start the experience' : 'Inicia sesión para empezar la experiencia'}
          </Link>
        </div>
      </section>
    </div>
  )
}

export default Home