import type { ApiCapsule } from '../services/api'

export function isTimeCapsuleLocked(capsule: ApiCapsule | null | undefined) {
  if (!capsule?.timeCapsule?.enabled || !capsule.timeCapsule.unlockAt) return false
  return new Date(capsule.timeCapsule.unlockAt) > new Date()
}

export function formatUnlockDate(unlockAt?: string | null) {
  if (!unlockAt) return ''

  const date = new Date(unlockAt)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}