import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchCurrentUser } from '../services/api'
import { 
  applyUserPreferences, 
  normalizeUserPreferences, 
  type NormalizedUserPreferences,
  DEFAULT_USER_PREFERENCES 
} from '../services/userPreferences'
import type { ApiUserPreferences } from '../services/api'

interface PreferencesContextType {
  preferences: NormalizedUserPreferences
  updatePreferences: (prefs: Partial<NormalizedUserPreferences>) => void
  isLoading: boolean
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<NormalizedUserPreferences>(DEFAULT_USER_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      const token = sessionStorage.getItem('authToken')
      if (!token) {
        applyUserPreferences(DEFAULT_USER_PREFERENCES)
        setIsLoading(false)
        return
      }

      try {
        const user = await fetchCurrentUser()
        const normalized = normalizeUserPreferences(user.preferences)
        setPreferences(normalized)
        applyUserPreferences(user.preferences)
      } catch (error) {
        console.error('Failed to load user preferences:', error)
        applyUserPreferences(DEFAULT_USER_PREFERENCES)
      } finally {
        setIsLoading(false)
      }
    }

    loadPreferences()
  }, [])

  // Listen for preference changes from other components/tabs
  useEffect(() => {
    const handlePreferencesChanged = () => {
      const raw = sessionStorage.getItem('authUser')
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { preferences?: ApiUserPreferences }
          const normalized = normalizeUserPreferences(parsed.preferences)
          setPreferences(normalized)
          applyUserPreferences(parsed.preferences)
        } catch (error) {
          console.error('Failed to update preferences from event:', error)
        }
      }
    }

    window.addEventListener('preferencesUpdated', handlePreferencesChanged)
    window.addEventListener('authUserChanged', handlePreferencesChanged)
    
    return () => {
      window.removeEventListener('preferencesUpdated', handlePreferencesChanged)
      window.removeEventListener('authUserChanged', handlePreferencesChanged)
    }
  }, [])

  const updatePreferences = (newPrefs: Partial<NormalizedUserPreferences>) => {
    const updated = { ...preferences, ...newPrefs }
    setPreferences(updated)
    applyUserPreferences(updated as NormalizedUserPreferences)
  }

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, isLoading }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider')
  }
  return context
}
