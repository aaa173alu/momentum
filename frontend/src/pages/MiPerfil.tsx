import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CapsulaThumb, { type ThumbCapsule } from '../components/CapsulaThumb'
import HeaderConTitulo from '../components/HeaderConTitulo'
import { defaultAvatarAsset } from '../img'
import { fetchCapsules, fetchCurrentUser, fetchFriends, getCapsuleThumb, type ApiCapsule, type ApiUser } from '../services/api'
import { useTranslate } from '../services/useTranslate'

function ownerId(capsule: ApiCapsule) {
  if (!capsule.owner) return ''
  return typeof capsule.owner === 'string' ? capsule.owner : capsule.owner._id
}

function mapToThumb(capsule: ApiCapsule): ThumbCapsule {
  const { thumbnailUrl, modelUrl } = getCapsuleThumb(capsule)
  return { id: capsule._id, nombre: capsule.title || 'Capsula', thumbnailUrl, modelUrl }
}

function MiPerfil() {
  const navigate = useNavigate()
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const [user, setUser] = useState<ApiUser | null>(null)
  const [friendsCount, setFriendsCount] = useState(0)
  const [capsules, setCapsules] = useState<ApiCapsule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [me, friends, allCapsules] = await Promise.all([
          fetchCurrentUser().catch(() => null),
          fetchFriends().catch(() => []),
          fetchCapsules().catch(() => []),
        ])

        setUser(me)
        setFriendsCount(friends.length)

        if (me?._id) {
          const myId = me._id
          const mine = (allCapsules || []).filter((capsule) => {
            const owner = ownerId(capsule)
            if (owner === myId) return true
            const shared = Array.isArray(capsule.sharedWith) && capsule.sharedWith.some((u: any) => (typeof u === 'string' ? u : u?._id) === myId)
            if (shared) return true
            const collab = Array.isArray(capsule.collaborators) && capsule.collaborators.some((c: any) => (typeof c.user === 'string' ? c.user : c.user?._id) === myId)
            if (collab) return true
            return false
          })
          setCapsules(mine)
        } else {
          setCapsules([])
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const username = useMemo(() => {
    const name = (user?.name || '').trim()
    return name ? name.toLowerCase().replace(/\s+/g, '') : 'usuario'
  }, [user?.name])

  const latestCapsules = useMemo(() => {
    const sorted = [...capsules].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return dateB - dateA
    })

    return sorted.slice(0, 5).map(mapToThumb)
  }, [capsules])

  const profilePhoto = user?.profilePhoto || user?.avatar || defaultAvatarAsset

  return (
    <>
      <HeaderConTitulo titulo={txt('Mi perfil', 'My profile')} iconoDerecha="⚙" onIconoDerecha={() => navigate('/ajustes')} />

      <section className="mi-perfil" aria-label={txt('Pantalla de mi perfil', 'My profile screen')}>

      {loading ? (
        <div className="mi-perfil__photo-fallback"><span>...</span></div>
      ) : profilePhoto ? (
        <img src={profilePhoto} alt={user?.name || txt('Usuario', 'User')} className="mi-perfil__photo" />
      ) : (
        <div className="mi-perfil__photo-fallback">
          <span>{(user?.name || 'U').charAt(0).toUpperCase()}</span>
        </div>
      )}

      <section className="mi-perfil__info-row">
        <span>@{username}</span>
        <span>{friendsCount} {txt('amigos', 'friends')}</span>
      </section>

      <section className="mi-perfil__recuerdos">
        <h2>{txt('Ultimos recuerdos', 'Latest memories')}</h2>

        <div className="mi-perfil__thumbs-row" role="list" aria-label={txt('Ultimas capsulas', 'Latest capsules')}>
          {latestCapsules.length === 0 ? (
            <div className="mi-perfil__empty">{txt('Sin recuerdos todavia', 'No memories yet')}</div>
          ) : (
            latestCapsules.map((capsula) => (
              <div key={capsula.id} role="listitem">
                <CapsulaThumb capsula={capsula} onOpen={(capsuleId) => navigate(`/capsulas/${capsuleId}`)} />
              </div>
            ))
          )}
        </div>
      </section>

      <div className="mi-perfil__more-wrap">
        <button type="button" className="mi-perfil__more" onClick={() => navigate('/mis-capsulas')}>
          {txt('Ver mas', 'See more')} {'>'}
        </button>
      </div>
    </section>
    </>
  )
}

export default MiPerfil
