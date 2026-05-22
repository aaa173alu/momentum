import { useTranslate } from '../services/useTranslate'

type ModalEliminarCuentaProps = {
  show: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

function ModalEliminarCuenta({ show, onClose, onConfirm, loading = false }: ModalEliminarCuentaProps) {
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  if (!show) return null

  return (
    <div className="settings-modal__overlay" role="dialog" aria-modal="true" aria-label={txt('Confirmar eliminacion de cuenta', 'Confirm account deletion')}>
      <article className="settings-modal__card">
        <p className="settings-modal__text">{txt('ESTAS SEGURO DE QUE QUIERES ELIMINAR TU CUENTA?', 'ARE YOU SURE YOU WANT TO DELETE YOUR ACCOUNT?')}</p>

        <div className="settings-modal__actions">
          <button type="button" className="settings-btn settings-btn--danger" onClick={onConfirm} disabled={loading}>
            {loading ? txt('ELIMINANDO...', 'DELETING...') : txt('Si, eliminar cuenta', 'Yes, delete account')}
          </button>
          <button type="button" className="settings-btn settings-btn--ghost" onClick={onClose} disabled={loading}>
            {txt('No, quiero a esta cuenta', 'No, keep this account')}
          </button>
        </div>
      </article>
    </div>
  )
}

export default ModalEliminarCuenta
