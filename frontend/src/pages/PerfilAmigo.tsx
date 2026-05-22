import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CapsulaThumb, { type ThumbCapsule } from '../components/CapsulaThumb'
import HeaderConAtras from '../components/HeaderConAtras'
import { defaultAvatarAsset } from '../img'
import { fetchCommonCapsules, fetchUserById, getCapsuleThumb, type ApiCapsule, type ApiFriendProfile } from '../services/api'
import { useTranslate } from '../services/useTranslate'

function mapCapsule(capsule: ApiCapsule): ThumbCapsule {
  const { thumbnailUrl, modelUrl } = getCapsuleThumb(capsule)
  return { id: capsule._id, nombre: capsule.title || 'Capsula', thumbnailUrl, modelUrl }
}

function getInitial(name: string) {
  const clean = name.trim()
  return clean ? clean.charAt(0).toUpperCase() : '?'
}

function PerfilAmigo() {
  const navigate = useNavigate()
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const params = useParams()
  const amigoId = params.amigoId || params.friendId || ''
  const [amigo, setAmigo] = useState<ApiFriendProfile | null>(null)
  const [capsulasEnComun, setCapsulasEnComun] = useState<ApiCapsule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!amigoId) {
        setLoading(false)
        return
      }

      try {
        const [friendData, capsules] = await Promise.all([
          fetchUserById(amigoId),
          fetchCommonCapsules(amigoId).catch(() => []),
        ])

        if (!active) return

        setAmigo(friendData)
        setCapsulasEnComun(capsules)
      } catch {
        if (active) {
          setAmigo(null)
          setCapsulasEnComun([])
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [amigoId])

  const username = useMemo(() => amigo?.username || amigo?.name?.toLowerCase().replace(/\s+/g, '') || 'amigo', [amigo])
  const friendPhoto = amigo?.profilePhoto || amigo?.avatar || defaultAvatarAsset
  const visibleCapsules = capsulasEnComun.slice(0, 3)

  return (
    <section className="perfil-amigo-page" aria-label={txt('Perfil de amigo', 'Friend profile')}>
      <HeaderConAtras onAtras={() => navigate(-1)} />

      <div className="perfil-amigo-page__photo-wrap">
        {loading ? (
          <div className="perfil-amigo-page__photo-fallback">
            <span>...</span>
          </div>
        ) : amigo?.profilePhoto || amigo?.avatar ? (
          <img className="perfil-amigo-page__photo" src={friendPhoto} alt={amigo?.name || txt('Amigo', 'Friend')} />
        ) : (
          <div className="perfil-amigo-page__photo-fallback">
            <span>{getInitial(amigo?.name || '')}</span>
          </div>
        )}

        <span className="perfil-amigo-page__badge">{txt('tu amigo', 'your friend')}</span>
      </div>

      <section className="perfil-amigo-page__info" aria-label={txt('Datos del amigo', 'Friend details')}>
        <span>@{username}</span>
        <span>{amigo?.totalAmigos ?? 0} {txt('amigos', 'friends')}</span>
      </section>

      <section className="perfil-amigo-page__common" aria-label={txt('Capsulas en comun', 'Capsules in common')}>
        <h2>{txt('Capsulas en comun', 'Capsules in common')}</h2>

        <div className="perfil-amigo-page__thumbs">
          {visibleCapsules.length > 0 ? (
            visibleCapsules.map((capsule) => (
              <CapsulaThumb key={capsule._id} capsula={mapCapsule(capsule)} onOpen={(capsuleId) => navigate(`/capsulas/${capsuleId}`)} />
            ))
          ) : (
            <p className="perfil-amigo-page__empty">{txt('No hay capsulas compartidas todavia.', 'No shared capsules yet.')}</p>
          )}
        </div>
      </section>

      <button
        type="button"
        className="perfil-amigo-page__share-btn"
        onClick={() => navigate('/capsulas/crear', { state: { shareWithFriendId: amigoId } })}
      >
        {txt('Compartir capsula +', 'Share capsule +')}
      </button>

      <div className="perfil-amigo-page__bottom-space" aria-hidden="true" />
    </section>
  )
}

export default PerfilAmigo
