import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { updateCurrentUserPreferences, type ApiUserPreferences } from '../services/api'

export type TemaVisual = 'claro' | 'oscuro' | 'altoContraste'

type TemaContextValue = {
  tema: TemaVisual
  cambiarTema: (nuevoTema: TemaVisual) => Promise<void>
}

const TemaContext = createContext<TemaContextValue | undefined>(undefined)

function resolveStoredTheme(rawUser: string | null): TemaVisual {
  if (!rawUser) return 'claro'

  try {
    const parsed = JSON.parse(rawUser) as { preferences?: ApiUserPreferences }
    const theme = parsed.preferences?.theme || parsed.preferences?.tema

    if (theme === 'oscuro' || theme === 'altoContraste' || theme === 'claro') return theme
    if (theme === 'dark') return 'oscuro'
    if (theme === 'light' || theme === 'system') return 'claro'
  } catch {
    return 'claro'
  }

  return 'claro'
}

function applyThemeToDocument(tema: TemaVisual) {
  document.documentElement.setAttribute('data-theme', tema)
}

function updateStoredUserTheme(tema: TemaVisual) {
  const rawUser = sessionStorage.getItem('authUser')
  if (!rawUser) return

  try {
    const parsed = JSON.parse(rawUser) as { preferences?: ApiUserPreferences; [key: string]: unknown }
    const updatedUser = {
      ...parsed,
      preferences: {
        ...(parsed.preferences || {}),
        theme: tema,
        tema,
      },
    }

    sessionStorage.setItem('authUser', JSON.stringify(updatedUser))
  } catch {
    sessionStorage.setItem('authUser', rawUser)
  }
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<TemaVisual>(() => resolveStoredTheme(sessionStorage.getItem('authUser')))

  useEffect(() => {
    applyThemeToDocument(tema)
  }, [tema])

  useEffect(() => {
    const syncFromStorage = () => {
      const storedTheme = resolveStoredTheme(sessionStorage.getItem('authUser'))
      setTema(storedTheme)
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'authUser') syncFromStorage()
    }

    const handleAuthUserChanged = () => {
      syncFromStorage()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('authUserChanged', handleAuthUserChanged as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('authUserChanged', handleAuthUserChanged as EventListener)
    }
  }, [])

  const cambiarTema = async (nuevoTema: TemaVisual) => {
    setTema(nuevoTema)
    applyThemeToDocument(nuevoTema)
    updateStoredUserTheme(nuevoTema)

    try {
      await updateCurrentUserPreferences({ tema: nuevoTema })
      window.dispatchEvent(new Event('authUserChanged'))
    } catch (error) {
      console.error('Error guardando tema:', error)
    }
  }

  const value = useMemo(() => ({ tema, cambiarTema }), [tema])

  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>
}

export function useTema() {
  const context = useContext(TemaContext)
  if (!context) {
    throw new Error('useTema must be used within TemaProvider')
  }

  return context
}