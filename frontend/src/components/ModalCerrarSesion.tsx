import { useTranslate } from '../services/useTranslate'

type ModalCerrarSesionProps = {
  show: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

function ModalCerrarSesion({ show, onClose, onConfirm, loading = false }: ModalCerrarSesionProps) {
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  if (!show) return null

  return (
    <div className="settings-modal__overlay" role="dialog" aria-modal="true" aria-label={txt('Confirmar cierre de sesion', 'Confirm logout')}>
      <article className="settings-modal__card">
        <p className="settings-modal__text">{txt('ESTAS SEGURO DE QUE QUIERES CERRAR SESION?', 'ARE YOU SURE YOU WANT TO LOG OUT?')}</p>

        <div className="settings-modal__actions">
          <button type="button" className="settings-btn settings-btn--danger" onClick={onConfirm} disabled={loading}>
            {loading ? txt('CERRANDO...', 'LOGGING OUT...') : txt('Si, cerrar sesion', 'Yes, log out')}
          </button>
          <button type="button" className="settings-btn settings-btn--ghost" onClick={onClose} disabled={loading}>
            {txt('No, mantener sesion abierta', 'No, keep session open')}
          </button>
        </div>
      </article>
    </div>
  )
}

export default ModalCerrarSesion
