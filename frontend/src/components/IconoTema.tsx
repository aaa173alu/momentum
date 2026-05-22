import { useEffect, useRef, useState } from 'react'
import { useTema, type TemaVisual } from '../context/TemaContext'

const OPTIONS: Array<{ tema: TemaVisual; label: string; icon: string }> = [
  { tema: 'claro', label: 'Claro', icon: '☀️' },
  { tema: 'oscuro', label: 'Oscuro', icon: '🌙' },
  { tema: 'altoContraste', label: 'Alto contraste', icon: '◑' },
]

function IconoTema() {
  const { tema, cambiarTema } = useTema()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return (
    <div className="icono-tema" ref={rootRef}>
      <button type="button" className="icono-tema__button" onClick={() => setOpen((value) => !value)} aria-label="Cambiar tema">
        <span className="icono-tema__glyph" aria-hidden="true">
          <span className="icono-tema__half icono-tema__half--left" />
          <span className="icono-tema__half icono-tema__half--right" />
        </span>
      </button>

      {open ? (
        <div className="icono-tema__popover" role="menu" aria-label="Seleccionar tema">
          {OPTIONS.map((option) => {
            const isActive = tema === option.tema

            return (
              <button
                key={option.tema}
                type="button"
                className={`icono-tema__option ${isActive ? 'is-active' : ''}`}
                onClick={async () => {
                  await cambiarTema(option.tema)
                  setOpen(false)
                }}
              >
                <span aria-hidden="true">{option.icon}</span>
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default IconoTema