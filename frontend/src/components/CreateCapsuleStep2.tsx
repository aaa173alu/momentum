import { Fragment, useEffect, useRef, useState } from 'react'
import type { CreateCapsuleFormState } from '../pages/CreateCapsuleFlowPage'
import type { ApiUser } from '../services/api'
import CreateCapsuleStep3 from './CreateCapsuleStep3'
import { useTranslate } from '../services/useTranslate'
import { usePreferences } from '../context/PreferencesContext'

interface CreateCapsuleStep2Props {
  form: CreateCapsuleFormState
  updateForm: (updates: Partial<CreateCapsuleFormState>) => void
  onContinue: () => void
  onBack: () => void
  currentUser: ApiUser
  isLoading: boolean
}

function CreateCapsuleStep2({
  form,
  updateForm,
  onContinue,
  onBack,
  currentUser,
  isLoading,
}: CreateCapsuleStep2Props) {
  const { language } = useTranslate()
  const txt = (es: string, en: string) => (language === 'en' ? en : es)
  const { preferences } = usePreferences()
  const topRef = useRef<HTMLDivElement>(null)
  const sharingSectionRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (form.compartirConAmigos) {
      window.requestAnimationFrame(() => {
        const behavior = preferences.reduceAnimations ? 'auto' : 'smooth'
        sharingSectionRef.current?.scrollIntoView({ behavior: behavior as ScrollBehavior, block: 'start' })
      })
    }
  }, [form.compartirConAmigos, preferences.reduceAnimations])

  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  const handleContinue = () => {
    setError('')
    onContinue()
  }

  const handlePrimaryAction = () => {
    if (form.compartirConAmigos) {
      const behavior = preferences.reduceAnimations ? 'auto' : 'smooth'
      sharingSectionRef.current?.scrollIntoView({ behavior: behavior as ScrollBehavior, block: 'start' })
      return
    }

    handleContinue()
  }

  const categoriesUi = [
    txt('Viajes', 'Travel'),
    txt('Estudio', 'Study'),
    txt('Amigos', 'Friends'),
    txt('Familia', 'Family'),
    txt('Otros', 'Other'),
  ]

  return (
    <Fragment>
      <div ref={topRef} />

      <div style={{ padding: '0 20px', marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8750rem', fontWeight: 500 }}>
          {txt('Descripción', 'Description')}
        </label>
        <textarea
          placeholder={txt('De cuando fuimos a Lanzarote.', 'When we went to Lanzarote.')}
          value={form.descripcion}
          onChange={(e) => updateForm({ descripcion: e.target.value })}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '1rem',
            minHeight: '120px',
            resize: 'none',
            backgroundColor: 'var(--color-fondo-secundario)',
            border: '1px solid var(--color-borde)',
            borderRadius: '8px',
            color: 'var(--color-texto-principal)',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', padding: '0 20px', marginBottom: '20px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8750rem', fontWeight: 500 }}>
            {txt('Categoría', 'Category')}
          </label>
          <select
            value={form.categoria}
            onChange={(e) => updateForm({ categoria: e.target.value })}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.8750rem',
              backgroundColor: 'var(--color-fondo-secundario)',
              border: '1px solid var(--color-borde)',
              borderRadius: '8px',
              color: 'var(--color-texto-principal)',
              boxSizing: 'border-box',
            }}
          >
            <option value="">{txt('Selecciona categoría', 'Select category')}</option>
            {categoriesUi.map((cat) => (
              <option key={cat} value={cat.toLowerCase()}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.timeCapsule.enabled}
              onChange={(e) =>
                updateForm({
                  timeCapsule: { ...form.timeCapsule, enabled: e.target.checked },
                })
              }
              disabled={isLoading}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.8750rem', fontWeight: 500 }}>{txt('Cápsula del tiempo', 'Time capsule')}</span>
          </label>
        </div>
      </div>

      {form.timeCapsule.enabled && (
        <div
          style={{
            backgroundColor: 'var(--color-fondo-secundario)',
            borderRadius: '10px',
            padding: '14px 16px',
            margin: '10px 20px',
            marginBottom: '20px',
            maxHeight: '500px',
            transition: 'max-height 0.3s ease',
            overflow: 'hidden',
          }}
        >
          <p style={{ fontSize: '0.8750rem', fontWeight: 500, marginBottom: '4px' }}>{txt('Ajustes cápsula del tiempo', 'Time capsule settings')}</p>
          <p style={{ fontSize: '0.7500rem', color: 'var(--color-texto-secundario)', marginBottom: '12px' }}>{txt('Abrir', 'Open')}</p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <select
              value={form.timeCapsule.type}
              onChange={(e) =>
                updateForm({
                  timeCapsule: { ...form.timeCapsule, type: e.target.value as 'partir_de' | 'despues_de' },
                })
              }
              disabled={isLoading}
              style={{
                flex: 0.5,
                padding: '10px',
                fontSize: '0.8750rem',
                backgroundColor: 'var(--color-fondo-principal)',
                border: '1px solid var(--color-borde)',
                borderRadius: '6px',
                color: 'var(--color-texto-principal)',
              }}
            >
              <option value="partir_de">{txt('A partir de', 'Starting from')}</option>
              <option value="despues_de">{txt('Después de', 'After')}</option>
            </select>

            <input
              type="date"
              min={getTodayDate()}
              value={form.timeCapsule.date || ''}
              onChange={(e) =>
                updateForm({
                  timeCapsule: { ...form.timeCapsule, date: e.target.value },
                })
              }
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '0.8750rem',
                backgroundColor: 'var(--color-fondo-principal)',
                border: '1px solid var(--color-borde)',
                borderRadius: '6px',
                color: 'var(--color-texto-principal)',
              }}
            />
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-separador)',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{txt('Compartir con amigos', 'Share with friends')}</span>
        </label>
        <input
          type="checkbox"
          checked={form.compartirConAmigos}
          onChange={(e) =>
            updateForm({
              compartirConAmigos: e.target.checked,
              sharingDecision: e.target.checked ? 'pending' : 'none',
            })
          }
          disabled={isLoading}
          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
        />
      </div>

      {form.compartirConAmigos && (
        <div ref={sharingSectionRef} style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-separador)' }}>
          <CreateCapsuleStep3
            form={form}
            updateForm={updateForm}
            onFinish={handleContinue}
            onBack={() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            currentUser={currentUser}
            isLoading={isLoading}
          />
        </div>
      )}

      {error && (
        <p style={{ color: '#8B2020', fontSize: '0.8750rem', padding: '0 20px', marginBottom: '16px' }}>
          {error}
        </p>
      )}

      {!form.compartirConAmigos && (
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
            onClick={handlePrimaryAction}
            disabled={isLoading || !form.title.trim() || !form.categoria.trim()}
            style={{
              padding: '12px 32px',
              backgroundColor: isLoading || !form.title.trim() || !form.categoria.trim() ? 'var(--color-borde)' : 'var(--color-boton-primario)',
              color: 'var(--color-boton-texto)',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading || !form.title.trim() || !form.categoria.trim() ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
            }}
          >
            {txt('Finalizar', 'Finish')}
          </button>
        </div>
      )}
    </Fragment>
  )
}

export default CreateCapsuleStep2