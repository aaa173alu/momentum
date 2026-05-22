import type { ApiUserPreferences } from './api'

export type NormalizedUserPreferences = {
  theme: 'claro' | 'oscuro' | 'altoContraste'
  language: 'es' | 'en'
  textSize: 'small' | 'normal' | 'large'
  reduceAnimations: boolean
  emphasizeFocus: boolean
  easyReadMode: boolean
}

export const DEFAULT_USER_PREFERENCES: NormalizedUserPreferences = {
  theme: 'claro',
  language: 'es',
  textSize: 'normal',
  reduceAnimations: false,
  emphasizeFocus: false,
  easyReadMode: false,
}

function normalizeTheme(theme?: ApiUserPreferences['theme'] | ApiUserPreferences['tema']) {
  if (theme === 'oscuro' || theme === 'altoContraste' || theme === 'claro') return theme
  if (theme === 'dark') return 'oscuro'
  if (theme === 'light' || theme === 'system') return 'claro'
  return DEFAULT_USER_PREFERENCES.theme
}

export function normalizeUserPreferences(prefs?: ApiUserPreferences | null): NormalizedUserPreferences {
  return {
    ...DEFAULT_USER_PREFERENCES,
    ...(prefs || {}),
    theme: normalizeTheme(prefs?.theme ?? prefs?.tema),
  }
}

export function applyUserPreferences(rawPrefs?: ApiUserPreferences | null) {
  const prefs = normalizeUserPreferences(rawPrefs)
  const root = document.documentElement
  const body = document.body

  root.lang = prefs.language
  root.setAttribute('data-language', prefs.language)
  root.setAttribute('data-text-size', prefs.textSize)
  root.setAttribute('data-theme', prefs.theme)

  body.classList.toggle('pref-reduce-animations', prefs.reduceAnimations)
  body.classList.toggle('pref-emphasize-focus', prefs.emphasizeFocus)
  body.classList.toggle('pref-easy-read', prefs.easyReadMode)
}

export function applyStoredUserPreferences() {
  const raw = sessionStorage.getItem('authUser')

  if (!raw) {
    applyUserPreferences(DEFAULT_USER_PREFERENCES)
    return
  }

  try {
    const parsed = JSON.parse(raw) as { preferences?: ApiUserPreferences }
    applyUserPreferences(parsed.preferences)
  } catch {
    applyUserPreferences(DEFAULT_USER_PREFERENCES)
  }
}
