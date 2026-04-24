import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function InitialLoading() {
  const navigate = useNavigate()
  const timeoutRef = useRef<number | null>(null)
  const navigatingRef = useRef(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // auto-advance after 6 seconds
    timeoutRef.current = window.setTimeout(() => handleAdvance(), 6000)

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
    setTimeout(() => navigate('/inicio-publico'), 300)
  }

  return (
    <section
      className={`initial-loading ${exiting ? 'fade-out' : ''}`}
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
      <div className="initial-loading__card">
        <span className="initial-loading__badge">Momentum</span>
        <h1>Preparando tu espacio</h1>
        <p>Estamos cargando tu experiencia para que puedas entrar a tus capsulas.</p>
        <div className="initial-loading__progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  )
}

export default InitialLoading