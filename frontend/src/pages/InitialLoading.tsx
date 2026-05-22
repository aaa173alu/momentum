import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function InitialLoading() {
  const navigate = useNavigate()
  const timeoutRef = useRef<number | null>(null)
  const navigatingRef = useRef(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // auto-advance after 5 seconds
    timeoutRef.current = window.setTimeout(() => handleAdvance(), 5000)

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAdvance() {
    if (navigatingRef.current) return
    navigatingRef.current = true

    // add a small exit animation before navigating
    setExiting(true)
    // wait for animation (300ms) then navigate
    window.setTimeout(() => navigate('/inicio-publico'), 300)
  }

  return (
    <section
      className={`onboarding-screen onboarding-screen--splash ${exiting ? 'fade-out' : ''}`}
      aria-label="Pantalla de carga inicial"
      onClick={() => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
        handleAdvance()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
          handleAdvance()
        }
      }}
    >
      <img src="/img/logo_momentum.svg" alt="Momentum" className="onboarding-screen__splash-logo" />
    </section>
  )
}

export default InitialLoading