import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { useNavigate } from 'react-router-dom'
import HeaderConAtras from '../components/HeaderConAtras'
import ModalEliminarCuenta from '../components/ModalEliminarCuenta'
import { defaultAvatarAsset } from '../img'
import {
  changeCurrentUserPassword,
  clearSession,
  deleteCurrentUser,
  fetchCurrentUser,
  updateCurrentUser,
  type ApiUser,
} from '../services/api'
import { useTranslate } from '../services/useTranslate'

function createCenteredCrop(width: number, height: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      1,
      width,
      height,
    ),
    width,
    height,
  )
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(blob)
  })
}

function SettingsAccountPage() {
  const navigate = useNavigate()
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const [originalUser, setOriginalUser] = useState<ApiUser | null>(null)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [previewImage, setPreviewImage] = useState('')
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null)

  const [cropSource, setCropSource] = useState('')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()

  const hasImageChange = useMemo(() => Boolean(selectedBlob), [selectedBlob])

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await fetchCurrentUser()
        setOriginalUser(user)
        setUsername(user.name || '')
        setEmail(user.email || '')
        setPreviewImage(user.profilePhoto || user.avatar || defaultAvatarAsset)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la cuenta')
      }
    }

    loadUser()
  }, [])

  function onPickImageClick() {
    fileInputRef.current?.click()
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      setCropSource(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  async function applyCrop() {
    if (!imageRef.current || !completedCrop || completedCrop.width <= 0 || completedCrop.height <= 0) return

    const image = imageRef.current
    const canvas = document.createElement('canvas')

    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    canvas.width = Math.max(1, Math.floor(completedCrop.width * scaleX))
    canvas.height = Math.max(1, Math.floor(completedCrop.height * scaleY))

    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    )

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.92)
    })

    if (!blob) {
      setError(txt('No se pudo recortar la imagen', 'Could not crop image'))
      return
    }

    setSelectedBlob(blob)
    setPreviewImage(URL.createObjectURL(blob))
    setCropSource('')
  }

  async function handleSave() {
    if (!originalUser) return

    setFeedback('')
    setError('')
    setPasswordError('')

    if (password !== '' && password !== repeatPassword) {
      setPasswordError(txt('Las contraseñas no coinciden', 'Passwords do not match'))
      return
    }

    setLoading(true)

    try {
      const payload: Parameters<typeof updateCurrentUser>[0] = {}

      if (username.trim() && username.trim() !== originalUser.name) {
        payload.name = username.trim()
      }

      if (email.trim() && email.trim() !== originalUser.email) {
        payload.email = email.trim()
      }

      if (hasImageChange && selectedBlob) {
        const photoData = await blobToDataUrl(selectedBlob)
        payload.profilePhoto = photoData
      }

      if (Object.keys(payload).length > 0) {
        const updatedUser = await updateCurrentUser(payload)
        setOriginalUser(updatedUser)
        localStorage.setItem('authUser', JSON.stringify(updatedUser))
      }

      if (password.trim()) {
        const currentPassword = window.prompt(txt('Introduce tu contrasena actual para confirmar el cambio de contrasena', 'Enter your current password to confirm the password change'))
        if (!currentPassword) {
          setError(txt('No se cambio la contrasena: falta confirmacion de contrasena actual', 'Password was not changed: current password confirmation is missing'))
        } else {
          await changeCurrentUserPassword(currentPassword, password.trim())
          setPassword('')
          setRepeatPassword('')
        }
      }

      setFeedback(txt('Cambios guardados correctamente', 'Changes saved successfully'))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : txt('No se pudo guardar', 'Could not save'))
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAccount() {
    if (!password.trim()) {
      setError(txt('Para eliminar la cuenta, introduce tu contrasena en el campo Contrasena', 'To delete the account, enter your password in the Password field'))
      setShowDeleteModal(false)
      return
    }

    setDeleting(true)
    setError('')

    try {
      await deleteCurrentUser(password.trim())
      clearSession()
      navigate('/')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : txt('No se pudo eliminar la cuenta', 'Could not delete the account'))
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  return (
    <Fragment>
      <HeaderConAtras onAtras={() => navigate(-1)} />
      <section className="settings-mobile" aria-label={txt('Ajustes de cuenta', 'Account settings')}>

      <h1 className="settings-title">{txt('AJUSTA TU PERFIL', 'ADJUST YOUR PROFILE')}</h1>

      <div className="settings-form">
        <label className="settings-label" htmlFor="settings-username">
          {txt('Nombre de usuario', 'Username')}
        </label>
        <input
          id="settings-username"
          className="settings-input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder={txt('Tu nombre', 'Your name')}
        />

        <label className="settings-label">{txt('Foto de usuario', 'Profile photo')}</label>
        <div className="settings-photo-row">
          <img className="settings-photo-preview" src={previewImage || defaultAvatarAsset} alt={txt('Foto de perfil', 'Profile photo')} />
          <button type="button" className="settings-photo-picker" onClick={onPickImageClick}>
            {txt('Selecciona foto de usuario', 'Choose profile photo')} {'>'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="settings-hidden-input"
            onChange={onFileChange}
          />
        </div>

        {cropSource ? (
          <div className="settings-cropper">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
              circularCrop
              aspect={1}
            >
              <img
                src={cropSource}
                alt={txt('Recorte', 'Crop')}
                ref={imageRef}
                onLoad={(event) => {
                  const target = event.currentTarget
                  setCrop(createCenteredCrop(target.width, target.height))
                }}
              />
            </ReactCrop>
            <div className="settings-cropper__actions">
              <button type="button" className="settings-btn settings-btn--primary" onClick={applyCrop}>{txt('Confirmar recorte', 'Confirm crop')}</button>
              <button type="button" className="settings-btn settings-btn--ghost" onClick={() => setCropSource('')}>{txt('Cancelar', 'Cancel')}</button>
            </div>
          </div>
        ) : null}

        <label className="settings-label" htmlFor="settings-email">
          {txt('Correo electronico', 'Email')}
        </label>
        <input
          id="settings-email"
          className="settings-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={txt('correo@ejemplo.com', 'example@email.com')}
        />

        <label className="settings-label" htmlFor="settings-password">
          {txt('Contrasena', 'Password')}
        </label>
        <input
          id="settings-password"
          className="settings-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={txt('Nueva contrasena', 'New password')}
        />

        <label className="settings-label" htmlFor="settings-repeat-password">
          {txt('Repetir contrasena', 'Repeat password')}
        </label>
        <input
          id="settings-repeat-password"
          className="settings-input"
          type="password"
          value={repeatPassword}
          onChange={(event) => setRepeatPassword(event.target.value)}
          placeholder={txt('Repite la contrasena', 'Repeat the password')}
        />

        {passwordError ? <p className="settings-error">{passwordError}</p> : null}
        {error ? <p className="settings-error">{error}</p> : null}
        {feedback ? <p className="settings-success">{feedback}</p> : null}

        <div className="settings-action-row">
          <button type="button" className="settings-btn settings-btn--primary" onClick={handleSave} disabled={loading}>
            {loading ? txt('GUARDANDO...', 'SAVING...') : txt('GUARDAR CAMBIOS', 'SAVE CHANGES')}
          </button>
          <button
            type="button"
            className="settings-btn settings-btn--danger"
            onClick={() => setShowDeleteModal(true)}
            disabled={loading || deleting}
          >
            {txt('ELIMINAR CUENTA', 'DELETE ACCOUNT')}
          </button>
        </div>
      </div>

      <ModalEliminarCuenta show={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteAccount} loading={deleting} />
      </section>
    </Fragment>
  )
}

export default SettingsAccountPage
