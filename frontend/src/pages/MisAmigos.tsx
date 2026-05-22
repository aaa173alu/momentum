import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTema } from '../context/TemaContext'
import CapsulaThumb, { type ThumbCapsule } from '../components/CapsulaThumb'
import { logoMAsset, settingsIconAsset } from '../img'
import {
  acceptFriendRequest,
  fetchCurrentUser,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchOutgoingFriendRequests,
  fetchCommonCapsules,
  getCapsuleThumb,
  rejectFriendRequest,
  requestFriendByUserId,
  searchUsers,
  type ApiCapsule,
  type ApiFriendRelation,
  type ApiUser,
} from '../services/api'
import { useTranslate } from '../services/useTranslate'
import { APP_PUBLIC_URL } from '../services/api'

type FriendItem = {
  friend: ApiUser
  capsules: ApiCapsule[]
}

type PendingItem = {
  relationId: string
  user: ApiUser
}

type AddStatus =
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'warning'; text: string }
  | null

function relationToFriend(relation: ApiFriendRelation): ApiUser | null {
  if (relation.friend && typeof relation.friend !== 'string') return relation.friend
  if (relation.otherUser && typeof relation.otherUser !== 'string') return relation.otherUser
  if (relation.recipient && typeof relation.recipient !== 'string') return relation.recipient
  if (relation.requester && typeof relation.requester !== 'string') return relation.requester
  return null
}

function mapCapsule(capsule: ApiCapsule): ThumbCapsule {
  const { thumbnailUrl, modelUrl } = getCapsuleThumb(capsule)
  return { id: capsule._id, nombre: capsule.title || 'Capsula', thumbnailUrl, modelUrl }
}

function getInitial(name: string) {
  const clean = name.trim()
  return clean ? clean.charAt(0).toUpperCase() : '?'
}

function getUserHandle(user: ApiUser) {
  const explicitUsername = String(user.username || '').trim().toLowerCase().replace(/\s+/g, '')
  if (explicitUsername) return explicitUsername

  const nameBasedUsername = String(user.name || '').trim().toLowerCase().replace(/\s+/g, '')
  return nameBasedUsername || 'usuario'
}

function MisAmigos() {
  const navigate = useNavigate()
  const { tema } = useTema()
  const logo = tema === 'oscuro' ? '/img/logo_m_blanco.svg' : logoMAsset
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const searchBoxRef = useRef<HTMLDivElement | null>(null)
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null)
  const [friendData, setFriendData] = useState<FriendItem[]>([])
  const [incomingRequests, setIncomingRequests] = useState<PendingItem[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<PendingItem[]>([])
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
  const [processingSearchUserId, setProcessingSearchUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [shareCopied, setShareCopied] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [searchResults, setSearchResults] = useState<ApiUser[]>([])
  const [sentSearchUserIds, setSentSearchUserIds] = useState<Record<string, boolean>>({})
  const [addStatus, setAddStatus] = useState<AddStatus>(null)

  const loadFriendData = async (acceptedFriends: ApiFriendRelation[]) => {
    const resolvedFriends = acceptedFriends
      .map((relation) => relationToFriend(relation))
      .filter((friend): friend is ApiUser => Boolean(friend))

    const commonCapsules = await Promise.all(
      resolvedFriends.map(async (friend) => {
        const capsules = await fetchCommonCapsules(friend._id).catch(() => [])
        return { friend, capsules }
      }),
    )

    setFriendData(commonCapsules)
  }

  const toIncomingPending = (relations: ApiFriendRelation[]): PendingItem[] => {
    return relations
      .map((relation) => ({
        relationId: relation._id,
        user: relation.requester && typeof relation.requester !== 'string' ? relation.requester : null,
      }))
      .filter((entry): entry is PendingItem => Boolean(entry.user))
  }

  const toOutgoingPending = (relations: ApiFriendRelation[]): PendingItem[] => {
    return relations
      .map((relation) => ({
        relationId: relation._id,
        user: relation.recipient && typeof relation.recipient !== 'string' ? relation.recipient : null,
      }))
      .filter((entry): entry is PendingItem => Boolean(entry.user))
  }

  const refreshFriendsAndRequests = async () => {
    const [acceptedFriends, incoming, outgoing] = await Promise.all([
      fetchFriends().catch(() => []),
      fetchIncomingFriendRequests().catch(() => []),
      fetchOutgoingFriendRequests().catch(() => []),
    ])

    setIncomingRequests(toIncomingPending(incoming))
    setOutgoingRequests(toOutgoingPending(outgoing))
    await loadFriendData(acceptedFriends)
  }

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const me = await fetchCurrentUser().catch(() => null)

        if (!active) return

        setCurrentUser(me)

        await refreshFriendsAndRequests()
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const query = busqueda.trim()

    if (query.length < 2) {
      setSearchingUsers(false)
      setSearchResults([])
      return
    }

    setSearchingUsers(true)

    const timeoutId = window.setTimeout(async () => {
      try {
        const users = await searchUsers(query)
        setSearchResults(users)
      } catch {
        setSearchResults([])
      } finally {
        setSearchingUsers(false)
      }
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [busqueda])

  useEffect(() => {
    const onDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (searchBoxRef.current && target && !searchBoxRef.current.contains(target)) {
        setSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocumentPointerDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentPointerDown)
    }
  }, [])

  const handleAcceptRequest = async (requestId: string) => {
    setProcessingRequestId(requestId)
    setAddStatus(null)

    try {
      await acceptFriendRequest(requestId)
      await refreshFriendsAndRequests()
      setAddStatus({ kind: 'success', text: txt('Solicitud aceptada', 'Request accepted') })
    } catch {
      setAddStatus({ kind: 'error', text: txt('No se pudo aceptar la solicitud', 'Could not accept request') })
    } finally {
      setProcessingRequestId(null)
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    setProcessingRequestId(requestId)
    setAddStatus(null)

    try {
      await rejectFriendRequest(requestId)
      await refreshFriendsAndRequests()
      setAddStatus({ kind: 'warning', text: txt('Solicitud rechazada', 'Request rejected') })
    } catch {
      setAddStatus({ kind: 'error', text: txt('No se pudo rechazar la solicitud', 'Could not reject request') })
    } finally {
      setProcessingRequestId(null)
    }
  }

  const handleRequestFromSearch = async (user: ApiUser) => {
    setProcessingSearchUserId(user._id)
    setAddStatus(null)

    try {
      await requestFriendByUserId(user._id)
      setSentSearchUserIds((prev) => ({ ...prev, [user._id]: true }))
      await refreshFriendsAndRequests()
      setAddStatus({ kind: 'success', text: `${txt('Solicitud enviada a', 'Request sent to')} @${getUserHandle(user)}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error'

      if (message === 'User not found') {
        setAddStatus({ kind: 'error', text: txt('Usuario no encontrado', 'User not found') })
      } else if (message === 'You are already friends') {
        setAddStatus({ kind: 'error', text: txt('Ya sois amigos', 'Already friends') })
      } else if (message === 'Friend request already sent') {
        setAddStatus({ kind: 'warning', text: txt('Solicitud ya enviada', 'Request already sent') })
      } else {
        setAddStatus({ kind: 'error', text: txt('No se pudo enviar la solicitud', 'Could not send request') })
      }
    } finally {
      setProcessingSearchUserId(null)
      setBusqueda('')
      setSearchResults([])
      setSearchOpen(false)
    }
  }

  const handleSelectSearchResult = () => {
    setBusqueda('')
    setSearchResults([])
    setSearchOpen(false)
  }

  const username = useMemo(() => {
    const clean = String(currentUser?.username || currentUser?.name || '').trim().toLowerCase().replace(/\s+/g, '')
    return clean || 'usuario'
  }, [currentUser])

  const shareUrl = useMemo(() => {
    return `${APP_PUBLIC_URL}/perfil/${username}`
  }, [username])
  const outgoingPendingIds = useMemo(() => new Set(outgoingRequests.map((entry) => entry.user._id)), [outgoingRequests])

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2000)
    } catch {
      setAddStatus({ kind: 'error', text: txt('No se pudo copiar el enlace', 'Could not copy link') })
    }
  }

  return (
      <section className="mis-amigos-page" aria-label={txt('Mis amigos', 'My friends')}>
        <header className="mis-amigos-page__header" aria-label={txt('Encabezado de amigos', 'Friends header')}>
        <span className="mis-amigos-page__header-spacer" aria-hidden="true" />

          <a className="mis-amigos-page__logo-button" href="/inicio" aria-label={txt('Ir a inicio', 'Go home')}>
          <img className="mis-amigos-page__logo" src={logo} alt="Momentum" />
        </a>

          <button type="button" className="mis-amigos-page__settings-button" onClick={() => navigate('/ajustes')} aria-label={txt('Abrir ajustes', 'Open settings')}>
          <img className="mis-amigos-page__settings-icon" src={settingsIconAsset} alt="" aria-hidden="true" />
        </button>
      </header>

        <h1 className="mis-amigos-page__title">{txt('MIS AMIGOS', 'MY FRIENDS')}</h1>

        <section className="mis-amigos-page__requests" aria-label={txt('Solicitudes de amistad', 'Friend requests')}>
          <article className="mis-amigos-panel" aria-label={txt('Bloque de solicitudes recibidas', 'Received requests')}>
            <h2 className="mis-amigos-page__add-title">{txt('SOLICITUDES RECIBIDAS', 'RECEIVED REQUESTS')}</h2>
          {incomingRequests.length === 0 ? (
              <p className="mis-amigos-page__empty">{txt('No tienes solicitudes pendientes.', 'You do not have any pending requests.')}</p>
          ) : (
            incomingRequests.map(({ relationId, user }) => (
              <article key={relationId} className="mis-amigos-request-row">
                <div className="mis-amigos-request-row__identity">
                  {user.profilePhoto || user.avatar ? (
                    <img className="mis-amigos-request-row__photo" src={user.profilePhoto || user.avatar} alt={user.name} />
                  ) : (
                    <div className="mis-amigos-request-row__photo-fallback" aria-label={`${txt('Sin foto de', 'No photo for')} ${user.name}`}>
                      <span>{getInitial(user.name)}</span>
                    </div>
                  )}
                  <span className="mis-amigos-request-row__name">{user.name}</span>
                </div>

                <div className="mis-amigos-request-row__actions">
                  <button
                    type="button"
                    className="mis-amigos-page__button"
                    disabled={processingRequestId === relationId}
                    onClick={() => handleAcceptRequest(relationId)}
                  >
                    {txt('Confirmar', 'Confirm')}
                  </button>
                  <button
                    type="button"
                    className="mis-amigos-page__button mis-amigos-page__button--ghost mis-amigos-page__button--icon"
                    disabled={processingRequestId === relationId}
                    onClick={() => handleRejectRequest(relationId)}
                    aria-label={`${txt('Rechazar solicitud de', 'Reject request from')} ${user.name}`}
                  >
                    x
                  </button>
                </div>
              </article>
            ))
          )}
        </article>

        <article className="mis-amigos-panel" aria-label={txt('Bloque de solicitudes enviadas', 'Sent requests')}>
          <h2 className="mis-amigos-page__add-title">{txt('SOLICITUDES ENVIADAS', 'SENT REQUESTS')}</h2>
          {outgoingRequests.length === 0 ? (
            <p className="mis-amigos-page__empty">{txt('No tienes solicitudes enviadas pendientes.', 'You do not have any pending sent requests.')}</p>
          ) : (
            outgoingRequests.map(({ relationId, user }) => (
              <article key={relationId} className="mis-amigos-request-row">
                <div className="mis-amigos-request-row__identity">
                  {user.profilePhoto || user.avatar ? (
                    <img className="mis-amigos-request-row__photo" src={user.profilePhoto || user.avatar} alt={user.name} />
                  ) : (
                    <div className="mis-amigos-request-row__photo-fallback" aria-label={`${txt('Sin foto de', 'No photo for')} ${user.name}`}>
                      <span>{getInitial(user.name)}</span>
                    </div>
                  )}
                  <span className="mis-amigos-request-row__name">{user.name}</span>
                </div>
                <span className="mis-amigos-request-row__pending">{txt('Pendiente', 'Pending')}</span>
              </article>
            ))
          )}
        </article>
      </section>

        <section className="mis-amigos-page__list" aria-label={txt('Lista de amigos', 'Friends list')}>
          {loading ? <p className="mis-amigos-page__empty">{txt('Cargando amigos...', 'Loading friends...')}</p> : null}
          {!loading && friendData.length === 0 ? <p className="mis-amigos-page__empty">{txt('Todavía no tienes amigos aceptados.', 'You do not have any accepted friends yet.')}</p> : null}

          {friendData.map(({ friend, capsules }) => {
            const visibleCapsules = capsules.slice(0, 3)
            const hasMore = capsules.length > 3

            return (
              <article key={friend._id} className="mis-amigos-row">
                <button
                  type="button"
                  className="mis-amigos-row__friend-btn"
                  onClick={() => navigate(`/perfil/${friend.name}`)}
                  aria-label={`${txt('Ver perfil de', 'View profile of')} ${friend.name}`}
                >
                  <div className="mis-amigos-row__photo-wrap">
                    {friend.profilePhoto || friend.avatar ? (
                      <img className="mis-amigos-row__photo" src={friend.profilePhoto || friend.avatar} alt={friend.name} />
                    ) : (
                      <div className="mis-amigos-row__photo-fallback" aria-label={`${txt('Sin foto de', 'No photo for')} ${friend.name}`}>
                        <span>{getInitial(friend.name)}</span>
                      </div>
                    )}
                  </div>
                  <span className="mis-amigos-row__name">{friend.name}</span>
                </button>

                <div className="mis-amigos-row__capsules" aria-label={`${txt('Cápsulas compartidas con', 'Shared capsules with')} ${friend.name}`}>
                  {visibleCapsules.map((capsule) => (
                    <CapsulaThumb key={capsule._id} capsula={mapCapsule(capsule)} onOpen={(capsuleId) => navigate(`/capsulas/${capsuleId}`)} />
                  ))}
                </div>

                {hasMore ? (
                  <button
                    type="button"
                    className="mis-amigos-row__more"
                    onClick={() => navigate(`/amigos/${friend._id}`)}
                    aria-label={`${txt('Ver más cápsulas compartidas con', 'View more shared capsules with')} ${friend.name}`}
                  >
                    {txt('Ver más', 'View more')} &gt;
                  </button>
                ) : null}
              </article>
            )
          })}
        </section>

        <section className="mis-amigos-page__add" aria-label={txt('Añadir amigos', 'Add friends')}>
          <h2 className="mis-amigos-page__add-title">{txt('AÑADIR AMIGOS', 'ADD FRIENDS')}</h2>

          <div className="mis-amigos-page__row">
            <input className="mis-amigos-page__input" type="text" value={shareUrl} readOnly aria-label={txt('URL para compartir perfil', 'Profile share URL')} />
            <button type="button" className="mis-amigos-page__button" onClick={handleCopyUrl}>
              {shareCopied ? txt('¡Copiado!', 'Copied!') : txt('Copiar', 'Copy')}
            </button>
          </div>

          <div className="mis-amigos-page__row">
            <div className="mis-amigos-page__search" ref={searchBoxRef}>
              <input
                className="mis-amigos-page__input"
                type="text"
                placeholder={txt('Introduce el nombre de tu amigo', 'Enter your friend\'s username')}
                value={busqueda}
                onFocus={() => {
                  if (busqueda.trim().length >= 2) {
                    setSearchOpen(true)
                  }
                }}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setBusqueda(nextValue)
                  setSearchOpen(nextValue.trim().length >= 2)
                }}
                aria-label={txt('Buscar amigo por nombre de usuario', 'Search friend by username')}
              />

              {searchOpen ? (
                <div className="mis-amigos-page__search-results" role="listbox" aria-label={txt('Resultados de usuarios', 'User results')}>
                  {searchingUsers ? <p className="mis-amigos-page__search-empty">{txt('Buscando usuarios...', 'Searching users...')}</p> : null}

                  {!searchingUsers && searchResults.length === 0 ? (
                    <p className="mis-amigos-page__search-empty">{txt('No se encontró ningún usuario', 'No user found')}</p>
                  ) : null}

                  {!searchingUsers && searchResults.map((user) => {
                    const handle = getUserHandle(user)
                    const requestAlreadySent = Boolean(sentSearchUserIds[user._id] || outgoingPendingIds.has(user._id))

                    return (
                      <article key={user._id} className="mis-amigos-page__search-item">
                        <button
                          type="button"
                          className="mis-amigos-page__search-main"
                          onClick={handleSelectSearchResult}
                          aria-label={`${txt('Seleccionar', 'Select')} ${handle}`}
                        >
                          {user.profilePhoto || user.avatar ? (
                            <img className="mis-amigos-page__search-avatar" src={user.profilePhoto || user.avatar} alt={user.name} />
                          ) : (
                            <div className="mis-amigos-page__search-avatar-fallback" aria-hidden="true">
                              <span>{getInitial(user.name)}</span>
                            </div>
                          )}
                          <span className="mis-amigos-page__search-username">@{handle}</span>
                        </button>

                        <button
                          type="button"
                          className="mis-amigos-page__search-add"
                          onClick={() => handleRequestFromSearch(user)}
                          disabled={requestAlreadySent || processingSearchUserId === user._id}
                          aria-label={`${txt('Enviar solicitud a', 'Send request to')} ${handle}`}
                        >
                          {requestAlreadySent ? txt('Solicitud enviada', 'Request sent') : '+'}
                        </button>
                      </article>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {addStatus ? (
            <p
              className={`mis-amigos-page__message mis-amigos-page__message--${addStatus.kind}`}
              aria-live="polite"
            >
              {addStatus.text}
            </p>
          ) : null}
        </section>

      <div className="mis-amigos-page__bottom-space" aria-hidden="true" />
    </section>
  )
}

export default MisAmigos
