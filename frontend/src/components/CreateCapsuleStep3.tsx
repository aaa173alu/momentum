import { Fragment, useState, useEffect, useRef } from 'react'
import type { CreateCapsuleFormState } from '../pages/CreateCapsuleFlowPage'
import type { ApiUser } from '../services/api'
import { fetchFriends } from '../services/api'
import { useTranslate } from '../services/useTranslate'
import { APP_PUBLIC_URL } from '../services/api'

interface CreateCapsuleStep3Props {
  form: CreateCapsuleFormState
  updateForm: (updates: Partial<CreateCapsuleFormState>) => void
  onFinish: () => void
  onBack: () => void
  currentUser: ApiUser
  isLoading: boolean
}

interface FriendSearch {
  userId: string
  username: string
  avatar: string | undefined
  name: string
}

function CreateCapsuleStep3({
  form,
  updateForm,
  onFinish,
  onBack,
  currentUser,
  isLoading,
}: CreateCapsuleStep3Props) {
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FriendSearch[]>([])
  const [openRoleSelect, setOpenRoleSelect] = useState<string | null>(null)
  const [shareButtonText, setShareButtonText] = useState(language === 'en' ? 'Share' : 'Compartir')
    useEffect(() => {
      setShareButtonText(language === 'en' ? 'Share' : 'Compartir')
    }, [language])

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([])
        return
      }

      try {
        const friends = await fetchFriends()
        // Filter friends based on search query
        const filtered = friends
          .map(rel => {
            const friend = typeof rel.friend === 'object' ? rel.friend : typeof rel.otherUser === 'object' ? rel.otherUser : null
            if (!friend) return null

            const username = friend.username || friend.name || friend.email || String(friend._id || '')
            return { userId: friend._id, username, avatar: friend.avatar, name: friend.name }
          })
          .filter((f): f is FriendSearch => f !== null && (f.username.includes(searchQuery) || f.name.includes(searchQuery)))

        setSearchResults(filtered)
      } catch (err) {
        console.error('Error searching friends:', err)
        setSearchResults([])
      }
    }

    // Debounce search
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(performSearch, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery])

  const handleAddColaborador = (friend: FriendSearch) => {
    const isAlreadyAdded = form.colaboradores.some(c => c.userId === friend.userId)
    if (!isAlreadyAdded) {
      updateForm({
        sharingDecision: 'friends',
        colaboradores: [
          ...form.colaboradores,
          {
            userId: friend.userId,
            username: friend.username,
            avatar: friend.avatar,
            rol: 'ver',
          },
        ],
      })
      setSearchQuery('')
      setSearchResults([])
    }
  }

  const handleRemoveColaborador = (userId: string) => {
    const nextCollaborators = form.colaboradores.filter(c => c.userId !== userId)
    updateForm({
      colaboradores: nextCollaborators,
      sharingDecision: nextCollaborators.length > 0 ? 'friends' : form.sharingDecision === 'link' ? 'link' : 'pending',
    })
  }

  const handleChangeRol = (userId: string, newRol: 'admin' | 'editar' | 'ver') => {
    updateForm({
      colaboradores: form.colaboradores.map(c =>
        c.userId === userId ? { ...c, rol: newRol } : c
      ),
    })
    setOpenRoleSelect(null)
  }

  const isAlreadyAdded = (userId: string) => form.colaboradores.some(c => c.userId === userId)

  const getRoleColor = (rol: 'admin' | 'editar' | 'ver') => {
    switch (rol) {
      case 'admin':
        return { bg: '#1A1A1A', text: 'white' }
      case 'editar':
        return { bg: '#2D6A4F', text: 'white' }
      case 'ver':
        return { bg: 'var(--color-fondo-secundario)', text: 'var(--color-texto-principal)', border: '1px solid var(--color-borde)' }
    }
  }

  const getRoleLabel = (rol: 'admin' | 'editar' | 'ver') => {
    switch (rol) {
      case 'admin':
        return 'Admin'
      case 'editar':
        return txt('Editar', 'Edit')
      case 'ver':
        return txt('Ver', 'View')
    }
  }

  const handleShareProfile = () => {
    const profileUrl = `${APP_PUBLIC_URL}/perfil/${currentUser.username}`
    updateForm({ sharingDecision: 'link' })
    
    if (navigator.share) {
      navigator
        .share({
          title: txt('Únete a Momentum', 'Join Momentum'),
          url: profileUrl,
        })
        .catch(() => {
          // Si el usuario cancela, usar el fallback
          navigator.clipboard.writeText(profileUrl)
          setShareButtonText(txt('¡Enlace copiado!', 'Link copied!'))
          setTimeout(() => setShareButtonText(txt('Compartir', 'Share')), 2000)
        })
    } else {
      // Fallback: copiar al portapapeles
      navigator.clipboard.writeText(profileUrl)
      setShareButtonText(txt('¡Enlace copiado!', 'Link copied!'))
      setTimeout(() => setShareButtonText(txt('Compartir', 'Share')), 2000)
    }
  }

  const canFinishCapsule = !form.compartirConAmigos || form.sharingDecision !== 'pending'

  return (
    <Fragment>
      {/* BUSCADOR DE AMIGOS */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-separador)' }}>
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder={txt('Buscar a tus amigos', 'Search your friends')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '0.8750rem',
              backgroundColor: 'var(--color-fondo-secundario)',
              border: '1px solid var(--color-borde)',
              borderRadius: '6px',
              color: 'var(--color-texto-principal)',
              boxSizing: 'border-box',
              paddingLeft: '36px',
            }}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem' }}>🔍</span>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--color-fondo-secundario)',
              borderRadius: '6px',
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid var(--color-borde)',
            }}
          >
            {searchResults.map(friend => (
              <div
                key={friend.userId}
                style={{
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  borderBottom: '1px solid var(--color-separador)',
                }}
              >
                {friend.avatar && (
                  <img
                    src={friend.avatar}
                    alt={friend.username}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                )}
                <span style={{ flex: 1, fontSize: '0.8750rem' }}>{friend.username.startsWith('@') ? friend.username : `@${friend.username}`}</span>
                <button
                  type="button"
                  onClick={() => handleAddColaborador(friend)}
                  disabled={isLoading || isAlreadyAdded(friend.userId)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: isAlreadyAdded(friend.userId) ? 'var(--color-borde)' : 'var(--color-boton-primario)',
                    color: 'white',
                    cursor: isAlreadyAdded(friend.userId) ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                  }}
                >
                  {isAlreadyAdded(friend.userId) ? '✓' : '+'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-texto-principal)', margin: 0 }}>
              {txt('¿No tiene cuenta?', 'No account?')}
            </p>
            <button
              type="button"
              onClick={handleShareProfile}
              disabled={isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                minWidth: '132px',
                backgroundColor: '#14263B',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(20, 38, 59, 0.16)',
                fontSize: '0.8750rem',
                lineHeight: 1,
              }}
            >
              <span style={{ fontSize: '0.9375rem', fontFamily: 'serif' }}>{shareButtonText}</span>
              <span style={{ fontSize: '1rem', marginLeft: 'auto' }}>➜</span>
            </button>
          </div>
          {!canFinishCapsule && (
            <p style={{ fontSize: '0.7500rem', color: 'var(--color-texto-secundario)', margin: '8px 0 0 0' }}>
              {txt('Antes de finalizar, añade amigos o comparte el enlace para quienes no tienen cuenta.', 'Before finishing, add friends or share the link for people without an account.')}
            </p>
          )}
        </div>
      </div>

      {/* LISTA DE COLABORADORES */}
      <div
        style={{
          backgroundColor: 'var(--color-fondo-secundario)',
          border: '1px solid var(--color-borde)',
          borderRadius: '12px',
          padding: '12px',
          margin: '16px 20px',
        }}
      >
        <p style={{ fontSize: '0.8750rem', fontWeight: 500, marginTop: 0, marginBottom: '12px', color: 'var(--color-texto-principal)' }}>
          {txt('Colaboradores', 'Collaborators')}
        </p>

        {form.colaboradores.map(colaborador => {
          const roleColor = getRoleColor(colaborador.rol)
          const isOpen = openRoleSelect === colaborador.userId

          return (
            <div
              key={colaborador.userId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                borderBottom: '0.5px solid var(--color-separador)',
              }}
            >
              {colaborador.avatar && (
                <img
                  src={colaborador.avatar}
                  alt={colaborador.username}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                />
              )}

              <span style={{ flex: 1, fontSize: '0.8750rem' }}>@{colaborador.username}</span>

              {/* Selector de Rol */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setOpenRoleSelect(isOpen ? null : colaborador.userId)}
                  disabled={isLoading}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: roleColor.border || 'none',
                    backgroundColor: roleColor.bg,
                    color: roleColor.text,
                    fontSize: '0.7500rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {getRoleLabel(colaborador.rol)}
                  <span>▾</span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: 'var(--color-fondo-secundario)',
                      border: '1px solid var(--color-borde)',
                      borderRadius: '6px',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                      zIndex: 2147483000,
                      minWidth: 140,
                      overflow: 'hidden',
                    }}
                  >
                    {(['admin', 'editar', 'ver'] as const).map(rol => (
                      <button
                        key={rol}
                        type="button"
                        onClick={() => handleChangeRol(colaborador.userId, rol)}
                        disabled={isLoading}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          textAlign: 'left',
                          fontSize: '0.8750rem',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-texto-principal)',
                          borderBottom: rol !== 'ver' ? '1px solid var(--color-separador)' : 'none',
                          display: 'block',
                        }}
                      >
                        {getRoleLabel(rol)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Botón eliminar */}
              <button
                type="button"
                onClick={() => handleRemoveColaborador(colaborador.userId)}
                disabled={isLoading}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#8B2020',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1250rem',
                }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* BOTONES */}
      <div style={{ display: 'flex', gap: '12px', padding: '20px', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          style={{
            padding: '12px 32px',
            backgroundColor: 'var(--color-fondo-secundario)',
            color: 'var(--color-texto-principal)',
            border: '1px solid var(--color-borde)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 500,
          }}
        >
          {txt('Atrás', 'Back')}
        </button>

        <button
          type="button"
          onClick={onFinish}
          disabled={isLoading || !canFinishCapsule}
          style={{
            padding: '12px 32px',
            backgroundColor: isLoading || !canFinishCapsule ? 'var(--color-borde)' : '#8B2020',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isLoading || !canFinishCapsule ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 500,
            minWidth: '140px',
          }}
        >
          {isLoading ? txt('Creando cápsula...', 'Creating capsule...') : txt('Finalizar', 'Finish')}
        </button>
      </div>
    </Fragment>
  )
}

export default CreateCapsuleStep3
