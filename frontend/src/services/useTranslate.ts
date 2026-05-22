import { usePreferences } from '../context/PreferencesContext'
import { translate, type TranslationKey, type Language } from './translations'

export function useTranslate() {
  const { preferences } = usePreferences()
  const language = (preferences.language as Language) || 'es'

  const t = (key: TranslationKey): string => {
    return translate(key, language)
  }

  return { t, language }
}
