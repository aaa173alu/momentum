import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  API_BASE_URL,
  type ApiNotification,
} from '../services/api.ts'
import { useTranslate } from '../services/useTranslate'

type NotificationBellProps = {
  token: string | null
  iconSrc?: string
}

function resolveUrl(url: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`
}

function resolveNotificationText(notification: ApiNotification, fallbackActor: string) {
  const actorName = typeof notification.actor === 'object' && notification.actor
    ? notification.actor.name
    : fallbackActor
  const message = notification.data?.message ?? notification.type.replaceAll('_', ' ')
  return `${actorName} ${message}`
}

function formatDate(value: string | undefined, locale: string, nowLabel: string) {
  if (!value) return nowLabel
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function NotificationBell({ token, iconSrc }: NotificationBellProps) {
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading] = useState(false)
  const [error, setError] = useState('')
  const [sharingModal, setSharingModal] = useState<ApiNotification | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [toast, setToast] = useState<ApiNotification | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const prevNotificationsRef = useRef<ApiNotification[]>([])

  const loadAll = async () => {
    try {
      const [countResult, notificationsResult] = await Promise.all([
        fetchUnreadNotificationCount(),
        fetchNotifications(),
      ])
      setUnreadCount(countResult.unreadCount)
      setNotifications(notificationsResult)

      // detect new unread notifications compared to previous load
      try {
        const prevIds = new Set(prevNotificationsRef.current.map((n) => n._id))
        const newOnes = notificationsResult.filter((n) => !prevIds.has(n._id) && !n.read)
        if (newOnes.length > 0) {
          showToast(newOnes[0])
        }
      } catch {
        // ignore
      }
      // store for next comparison
      prevNotificationsRef.current = notificationsResult

      const pending = notificationsResult.find(
        (n) => !n.read && n.type === 'collaborator_added'
      )
      if (pending) setSharingModal(pending)
    } catch {
      setUnreadCount(0)
    }
  }

  function showToast(notification: ApiNotification) {
    setToast(notification)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    // stay for 5 seconds
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000)
  }

  function hideToast() {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = null
    setToast(null)
  }

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!token) {
      setNotifications([])
      setUnreadCount(0)
      setOpen(false)
      setSharingModal(null)
      return
    }

    loadAll()
    const intervalId = window.setInterval(loadAll, 60000)
    return () => window.clearInterval(intervalId)
  }, [token])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (err) {
      setError(err instanceof Error ? err.message : txt('No se pudieron marcar como leidas', 'Could not mark all as read'))
    }
  }

  async function handleMarkRead(notificationId: string) {
    try {
      await markNotificationRead(notificationId)
      setNotifications((prev) =>
        prev.map((n) => n._id === notificationId ? { ...n, read: true } : n)
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      setError(err instanceof Error ? err.message : txt('No se pudo actualizar la notificacion', 'Could not update notification'))
    }
  }

  async function handleAcceptSharing(notification: ApiNotification) {
    const capsuleId = notification.data?.capsuleId
    await markNotificationRead(notification._id).catch(() => {})
    setNotifications((prev) => prev.map((n) => n._id === notification._id ? { ...n, read: true } : n))
    setUnreadCount((prev) => Math.max(0, prev - 1))
    setSharingModal(null)
    if (capsuleId) navigate(`/capsulas/${capsuleId}/compartida`)
  }

  async function handleRejectSharing(notification: ApiNotification) {
    const capsuleId = notification.data?.capsuleId
    if (!capsuleId) { setSharingModal(null); return }

    const authUser = sessionStorage.getItem('authUser')
    const currentUserId = authUser ? JSON.parse(authUser)._id : null
    if (!currentUserId) { setSharingModal(null); return }

    setRejectingId(notification._id)
    try {
      const token = sessionStorage.getItem('authToken')
      await fetch(`${API_BASE_URL}/api/capsules/${capsuleId}/collaborators/${currentUserId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      await markNotificationRead(notification._id).catch(() => {})
      setNotifications((prev) => prev.map((n) => n._id === notification._id ? { ...n, read: true } : n))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silently dismiss
    } finally {
      setRejectingId(null)
      setSharingModal(null)
    }
  }

  if (!token) return null

  const actor = sharingModal
    ? (typeof sharingModal.actor === 'object' ? sharingModal.actor : null)
    : null
  const actorName = actor?.name ?? txt('Alguien', 'Someone')
  const actorAvatar = actor?.avatar ?? null

  return (
    <>
      <div className="notification-bell" ref={containerRef}>
        <button
          type="button"
          className="notification-bell__button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={txt('Abrir notificaciones', 'Open notifications')}
          aria-expanded={open}
        >
          {iconSrc
            ? <img src={iconSrc} alt="" aria-hidden="true" className="notification-bell__icon" />
            : <span aria-hidden="true">🔔</span>}
          {unreadCount > 0 && <span className="notification-bell__badge">{unreadCount}</span>}
        </button>

        {open && (
          <div className="notification-bell__panel">
            <div className="notification-bell__panel-header">
              <strong>{txt('Notificaciones', 'Notifications')}</strong>
              <button type="button" className="notification-bell__link" onClick={handleMarkAllRead}>
                {txt('Marcar todo como leido', 'Mark all as read')}
              </button>
            </div>

            {error && <p className="notification-bell__status">{error}</p>}

            {loading ? (
              <p className="notification-bell__status">{txt('Cargando...', 'Loading...')}</p>
            ) : notifications.length === 0 ? (
              <p className="notification-bell__status">{txt('No tienes notificaciones.', 'You have no notifications.')}</p>
            ) : (
              <ul className="notification-bell__list">
                {notifications.map((notification) => (
                  <li
                    key={notification._id}
                    className={`notification-bell__item ${notification.read ? 'is-read' : ''}`}
                  >
                    <div className="notification-bell__item-row">
                      <button
                        type="button"
                        className="notification-bell__item-button"
                        onClick={async () => {
                          // Navigate to the relevant place first, then mark as read
                          try {
                            const target = (() => {
                              const t = notification.type
                              const data = notification.data || {}
                              // friend_request -> open friends page
                              if (t === 'friend_request') return '/amigos'
                              // friend_accepted -> go to friend's profile if actor id available
                              if (t === 'friend_accepted') {
                                if (notification.actor && typeof notification.actor !== 'string') return `/amigos/${notification.actor._id}`
                                if (data.relationId) return `/amigos`
                                return '/amigos'
                              }
                              // collaborator_added -> go to capsule (edit if role=edit/admin else shared/view)
                              if (t === 'collaborator_added') {
                                const capsuleId = data.capsuleId
                                const role = String(data.role || '')
                                if (!capsuleId) return '/mis-capsulas'
                                if (role === 'admin' || role === 'edit') return `/capsulas/${capsuleId}/editar`
                                return `/capsulas/${capsuleId}`
                              }
                              // comment_added or others -> open capsule if provided
                              if (t === 'comment_added') {
                                const capsuleId = data.capsuleId
                                if (capsuleId) return `/capsulas/${capsuleId}`
                                return '/inicio'
                              }
                              return '/inicio'
                            })()

                            navigate(target)
                          } finally {
                            // mark as read after navigation (best-effort)
                            await handleMarkRead(notification._id).catch(() => {})
                          }
                        }}
                      >
                        <span className="notification-bell__item-text">
                          {resolveNotificationText(notification, txt('Alguien', 'Someone'))}
                        </span>
                        <span className="notification-bell__item-meta">
                          {formatDate(notification.createdAt, language === 'en' ? 'en-US' : 'es-ES', txt('Hace un momento', 'Just now'))}
                        </span>
                      </button>

                      {!notification.read && (
                        <button
                          type="button"
                          className="notification-bell__item-mark-read"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleMarkRead(notification._id)
                          }}
                          aria-label={txt('Marcar como leida', 'Mark as read')}
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Sharing modal overlay */}
      {sharingModal && (
        <div className="nb-sharing-overlay">
          <div className="nb-sharing-modal">
            <div className="nb-sharing-modal__actor">
              <div className="nb-sharing-modal__avatar">
                {actorAvatar
                  ? <img src={resolveUrl(actorAvatar)} alt={actorName} />
                  : <span>{actorName.charAt(0).toUpperCase()}</span>}
              </div>
              <p className="nb-sharing-modal__text">
                <strong>{actorName}</strong> {txt('te ha compartido una capsula', 'shared a capsule with you')}
              </p>
            </div>

            <div className="nb-sharing-modal__actions">
              <button
                type="button"
                className="nb-sharing-modal__btn nb-sharing-modal__btn--reject"
                onClick={() => handleRejectSharing(sharingModal)}
                disabled={rejectingId === sharingModal._id}
              >
                {txt('Rechazar', 'Reject')}
              </button>
              <button
                type="button"
                className="nb-sharing-modal__btn nb-sharing-modal__btn--accept"
                onClick={() => handleAcceptSharing(sharingModal)}
              >
                {txt('Aceptar', 'Accept')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast / globo de notificación entrante */}
      {toast && (
        <div className="notification-toast" role="status" aria-live="polite">
          <div className="notification-toast__content">
            <button
              type="button"
              className="notification-toast__close"
              onClick={() => hideToast()}
              aria-label={txt('Cerrar notificación', 'Close notification')}
            >
              ×
            </button>
            <button
              type="button"
              className="notification-toast__action"
              onClick={async () => {
                // navigate to relevant target then mark read
                try {
                  const t = toast
                  if (!t) return
                  const data = t.data || {}
                  let target = '/inicio'
                  if (t.type === 'friend_request') target = '/amigos'
                  else if (t.type === 'friend_accepted') {
                    if (t.actor && typeof t.actor !== 'string') target = `/amigos/${t.actor._id}`
                    else target = '/amigos'
                  } else if (t.type === 'collaborator_added') {
                    const capsuleId = data.capsuleId
                    const role = String(data.role || '')
                    if (capsuleId) target = (role === 'admin' || role === 'edit') ? `/capsulas/${capsuleId}/editar` : `/capsulas/${capsuleId}`
                    else target = '/mis-capsulas'
                  } else if (t.type === 'comment_added') {
                    const capsuleId = data.capsuleId
                    if (capsuleId) target = `/capsulas/${capsuleId}`
                  }

                  navigate(target)
                } finally {
                  if (toast) await handleMarkRead(toast._id).catch(() => {})
                  hideToast()
                }
              }}
            >
              <span className="notification-toast__text">{resolveNotificationText(toast, txt('Alguien', 'Someone'))}</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default NotificationBell
