import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HeaderConAtras from '../components/HeaderConAtras'
import { fetchCurrentUser, updateCurrentUserPreferences, type ApiUserPreferences } from '../services/api'
import { applyUserPreferences, normalizeUserPreferences, type NormalizedUserPreferences } from '../services/userPreferences'
import { useTranslate } from '../services/useTranslate'

const DEFAULT_PREFS: NormalizedUserPreferences = {
  theme: 'claro',
  language: 'es',
  textSize: 'normal',
  reduceAnimations: false,
  emphasizeFocus: false,
  easyReadMode: false,
}

function SettingsPreferencesPage() {
  const navigate = useNavigate()
  const { t } = useTranslate()
  const [originalPrefs, setOriginalPrefs] = useState<NormalizedUserPreferences>(DEFAULT_PREFS)
  const [prefs, setPrefs] = useState<NormalizedUserPreferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const user = await fetchCurrentUser()
        const userPrefs = {
          ...DEFAULT_PREFS,
          ...(user.preferences || {}),
        }
        setOriginalPrefs(userPrefs)
        setPrefs(userPrefs)
        applyUserPreferences(userPrefs)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t('loadError'))
      }
    }

    load()
  }, [])

  async function handleSave() {
    setLoading(true)
    setError('')
    setSuccess('')

    const changed: ApiUserPreferences = {}

    if (prefs.language !== originalPrefs.language) changed.language = prefs.language
    if (prefs.textSize !== originalPrefs.textSize) changed.textSize = prefs.textSize
    if (prefs.reduceAnimations !== originalPrefs.reduceAnimations) changed.reduceAnimations = prefs.reduceAnimations
    if (prefs.emphasizeFocus !== originalPrefs.emphasizeFocus) changed.emphasizeFocus = prefs.emphasizeFocus
    if (prefs.easyReadMode !== originalPrefs.easyReadMode) changed.easyReadMode = prefs.easyReadMode

    try {
      if (Object.keys(changed).length > 0) {
        const updatedUser = await updateCurrentUserPreferences(changed)
        const updatedPrefs = normalizeUserPreferences(updatedUser.preferences)
        setOriginalPrefs(updatedPrefs)
        setPrefs(updatedPrefs)
        sessionStorage.setItem('authUser', JSON.stringify(updatedUser))
        applyUserPreferences(updatedPrefs)
        window.dispatchEvent(new Event('authUserChanged'))
        window.dispatchEvent(new Event('preferencesUpdated'))
      }

      setSuccess(t('saved'))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('saveError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Fragment>
      <HeaderConAtras onAtras={() => navigate(-1)} />
      <section className="settings-mobile" aria-label="Ajustes de preferencias">

      <h1 className="settings-title">{t('selectPreferences')}</h1>

      <div className="settings-form settings-form--spacious">
        <label className="settings-label" htmlFor="settings-language">{t('language')}</label>
        <select
          id="settings-language"
          className="settings-select"
          value={prefs.language}
          onChange={(event) => setPrefs((prev) => ({ ...prev, language: event.target.value as 'es' | 'en' }))}
        >
          <option value="es">{t('spanish')}</option>
          <option value="en">{t('english')}</option>
        </select>

        <label className="settings-label" htmlFor="settings-text-size">{t('textSize')}</label>
        <select
          id="settings-text-size"
          className="settings-select"
          value={prefs.textSize}
          onChange={(event) => setPrefs((prev) => ({ ...prev, textSize: event.target.value as 'small' | 'normal' | 'large' }))}
        >
          <option value="small">{t('small')}</option>
          <option value="normal">{t('normal')}</option>
          <option value="large">{t('large')}</option>
        </select>

        <div className="settings-switch-row">
          <span>{t('reduceAnimations')}</span>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={prefs.reduceAnimations}
              onChange={(event) => setPrefs((prev) => ({ ...prev, reduceAnimations: event.target.checked }))}
            />
            <span className="settings-switch__slider" />
          </label>
        </div>

        <div className="settings-switch-row">
          <span>{t('emphasizeFocus')}</span>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={prefs.emphasizeFocus}
              onChange={(event) => setPrefs((prev) => ({ ...prev, emphasizeFocus: event.target.checked }))}
            />
            <span className="settings-switch__slider" />
          </label>
        </div>

        <div className="settings-switch-row">
          <span>{t('easyRead')}</span>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={prefs.easyReadMode}
              onChange={(event) => setPrefs((prev) => ({ ...prev, easyReadMode: event.target.checked }))}
            />
            <span className="settings-switch__slider" />
          </label>
        </div>

        {error ? <p className="settings-error">{error}</p> : null}
        {success ? <p className="settings-success">{success}</p> : null}

        <button type="button" className="settings-btn settings-btn--primary settings-btn--full" onClick={handleSave} disabled={loading}>
          {loading ? t('saving') : t('saveChanges')}
        </button>
      </div>
      </section>
    </Fragment>
  )
}

export default SettingsPreferencesPage
