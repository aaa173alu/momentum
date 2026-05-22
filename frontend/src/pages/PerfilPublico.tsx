import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  acceptFriendRequest,
  fetchCommonCapsules,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchPublicUserFriends,
  getCapsuleThumb,
  rejectFriendRequest,
  requestFriendByUsername,
  searchUsers,
  type ApiCapsule,
  type ApiFriendRelation,
  type ApiUser,
} from '../services/api'
import HeaderConAtras from '../components/HeaderConAtras'
import CapsulaThumb, { type ThumbCapsule } from '../components/CapsulaThumb'
import { useTranslate } from '../services/useTranslate'

function mapCapsule(capsule: ApiCapsule): ThumbCapsule {
  const { thumbnailUrl, modelUrl } = getCapsuleThumb(capsule)
  return { id: capsule._id, nombre: capsule.title || 'Capsula', thumbnailUrl, modelUrl }
}

function getInitial(name: string) {
  const clean = name.trim()
  return clean ? clean.charAt(0).toUpperCase() : '?'
}

function PerfilPublico() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)

  const [user, setUser] = useState<ApiUser | null>(null)
  const [capsules, setCapsules] = useState<ApiCapsule[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [incomingRequest, setIncomingRequest] = useState<ApiFriendRelation | null>(null)
  const [isAlreadyFriend, setIsAlreadyFriend] = useState(false)
  const [friendCount, setFriendCount] = useState(0)
  const [processingAction, setProcessingAction] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!username) {
        setLoading(false)
        return
      }

      try {
        const results = await searchUsers(username)
        // find exact name match or partial match
        const found = results.find((u) => String(u.name || '').toLowerCase() === String(username).toLowerCase())
          || results.find((u) => String(u.name || '').toLowerCase().includes(String(username).toLowerCase()))
        if (!found) {
          if (active) setUser(null)
          return
        }

        if (active) setUser(found)
        
        // Check if already friend and get friend count
        const [myFriends, incomingRequests, publicFriendData, common] = await Promise.all([
          fetchFriends().catch(() => []),
          fetchIncomingFriendRequests().catch(() => []),
          fetchPublicUserFriends(username).catch(() => ({ friendCount: 0, friends: [] })),
          fetchCommonCapsules(found._id).catch(() => []),
        ])

        if (!active) return

        // Check if already friends
        const isFriend = myFriends.some((rel) => {
          const friendId = rel.friend && typeof rel.friend !== 'string' ? rel.friend._id : rel.friend
          const otherUserId = rel.otherUser && typeof rel.otherUser !== 'string' ? rel.otherUser._id : rel.otherUser
          return String(friendId || otherUserId) === String(found._id)
        })
        
        if (active) setIsAlreadyFriend(isFriend)

        // Check for incoming friend request from this user
        const hasRequest = incomingRequests.find(
          (rel) => rel.requester && typeof rel.requester !== 'string' && String(rel.requester._id) === String(found._id)
        )
        if (active && hasRequest) setIncomingRequest(hasRequest)

        // Get friend count for this user
        if (active) setFriendCount(publicFriendData.friendCount)
        if (active) setCapsules(common)
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [username])

  const handleRequestFriend = async () => {
    if (!user) return
    const token = sessionStorage.getItem('authToken')
    if (!token) {
      // redirect to login, then come back here
      navigate('/login', { state: { redirectTo: window.location.pathname + window.location.search } })
      return
    }

    setSending(true)
    setMessage('')
    try {
      await requestFriendByUsername(user.name || '')
      setMessage(txt('Solicitud enviada', 'Request sent'))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : txt('Error al enviar solicitud', 'Error sending request'))
    } finally {
      setSending(false)
    }
  }

  const handleAcceptRequest = async () => {
    if (!incomingRequest) return
    setProcessingAction(true)
    setMessage('')
    try {
      await acceptFriendRequest(incomingRequest._id)
      setMessage(txt('Amistad aceptada', 'Friendship accepted'))
      setIncomingRequest(null)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : txt('Error al aceptar', 'Error accepting request'))
    } finally {
      setProcessingAction(false)
    }
  }

  const handleRejectRequest = async () => {
    if (!incomingRequest) return
    setProcessingAction(true)
    setMessage('')
    try {
      await rejectFriendRequest(incomingRequest._id)
      setMessage(txt('Solicitud rechazada', 'Request rejected'))
      setIncomingRequest(null)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : txt('Error al rechazar', 'Error rejecting request'))
    } finally {
      setProcessingAction(false)
    }
  }

  if (loading) return <section className="page-layout"><p>{txt('Cargando...', 'Loading...')}</p></section>

  if (!user) return (
    <section className="page-layout">
      <HeaderConAtras onAtras={() => navigate(-1)} />
      <p>{txt('Usuario no encontrado', 'User not found')}</p>
    </section>
  )

  const profilePhoto = user.profilePhoto || user.avatar

  return (
    <>
      <HeaderConAtras onAtras={() => navigate(-1)} />

      <section className="mi-perfil" aria-label={txt('Perfil público', 'Public profile')}>
        {profilePhoto ? (
          <img src={profilePhoto} alt={user.name} className="mi-perfil__photo" />
        ) : (
          <div className="mi-perfil__photo-fallback">
            <span>{getInitial(user.name)}</span>
          </div>
        )}

        <section className="mi-perfil__info-row">
          <span>{user.name}</span>
          <span>{friendCount} {txt('amigos', 'friends')}</span>
        </section>

        <section className="mi-perfil__actions">
          {isAlreadyFriend ? (
            <p className="mi-perfil__message">{txt('Ya sois amigos', 'Already friends')}</p>
          ) : incomingRequest ? (
            <div className="mi-perfil__request-actions">
              <button
                type="button"
                className="mi-perfil__button mi-perfil__button--primary"
                disabled={processingAction}
                onClick={handleAcceptRequest}
              >
                {txt('Aceptar', 'Accept')}
              </button>
              <button
                type="button"
                className="mi-perfil__button mi-perfil__button--ghost"
                disabled={processingAction}
                onClick={handleRejectRequest}
              >
                {txt('Cancelar', 'Cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mi-perfil__button mi-perfil__button--primary"
              disabled={sending}
              onClick={handleRequestFriend}
            >
              {txt('Solicitar amistad', 'Request friendship')}
            </button>
          )}
          {message && <p className="mi-perfil__message">{message}</p>}
        </section>

        <section className="mi-perfil__recuerdos">
          <h2>{txt('Cápsulas compartidas', 'Shared capsules')}</h2>

          <div className="mi-perfil__thumbs-row" role="list" aria-label={txt('Cápsulas compartidas', 'Shared capsules')}>
            {capsules.length === 0 ? (
              <div className="mi-perfil__empty">{txt('No hay cápsulas públicas para mostrar.', 'No public capsules to show.')}</div>
            ) : (
              capsules.slice(0, 5).map((capsule) => (
                <div key={capsule._id} role="listitem">
                  <CapsulaThumb capsula={mapCapsule(capsule)} onOpen={(capsuleId) => navigate(`/capsulas/${capsuleId}`)} />
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </>
  )
}

export default PerfilPublico
