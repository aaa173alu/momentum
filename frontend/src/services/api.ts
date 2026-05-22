const LOCAL_API_URL = 'http://localhost:5000'
const PRODUCTION_API_URL = 'https://momentum-hc2x.onrender.com'

function isLocalhostHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const runtimeDefaultApiUrl = typeof window !== 'undefined' && isLocalhostHost(window.location.hostname)
  ? LOCAL_API_URL
  : PRODUCTION_API_URL

export const API_BASE_URL = (
  configuredApiUrl && !(configuredApiUrl.includes('localhost') && runtimeDefaultApiUrl === PRODUCTION_API_URL)
    ? configuredApiUrl
    : runtimeDefaultApiUrl
).replace(/\/$/, '')
export const APP_PUBLIC_URL = (import.meta.env.VITE_APP_URL ?? 'https://momentum-frontend-xjzj.onrender.com').replace(/\/$/, '')

export type ApiUser = {
  _id: string
  name: string
  username?: string
  email: string
  avatar?: string
  profilePhoto?: string
  biography?: string
  birthDate?: string | null
  country?: string
  gender?: 'male' | 'female' | 'other' | 'prefer_not_say'
  preferences?: ApiUserPreferences
}

export type ApiUserPreferences = {
  theme?: 'claro' | 'oscuro' | 'altoContraste'
  tema?: 'claro' | 'oscuro' | 'altoContraste'
  language?: 'es' | 'en'
  textSize?: 'small' | 'normal' | 'large'
  reduceAnimations?: boolean
  emphasizeFocus?: boolean
  easyReadMode?: boolean
}

export type ApiMediaItem = {
  _id?: string
  type?: 'image' | 'video' | 'audio' | 'file' | '3d'
  url: string
  author?: ApiUser | string
  modelFormat?: '' | 'glb' | 'gltf' | 'obj' | 'fbx' | 'stl'
  fileName?: string
  originalName?: string
  mimeType?: string
  fileSize?: number
  title?: string
  description?: string
  thumbnailUrl?: string
  comments?: Array<{
    _id?: string
    author: ApiUser | string
    text: string
    createdAt?: string
  }>
}

export type ApiCapsule = {
  _id: string
  title: string
  description?: string
  category?: string
  colorHalo?: string
  design?: {
    key?: string
    label?: string
  }
  timeCapsule?: {
    enabled?: boolean
    unlockAt?: string | null
  }
  owner?: ApiUser | string
  sharedWith?: Array<ApiUser | string>
  collaborators?: Array<{ user: ApiUser | string; role: 'admin' | 'edit' | 'view' }>
  mediaItems?: ApiMediaItem[]
  previewImage?: string
  mediaFile?: string
  date?: string
  createdAt?: string
  updatedAt?: string
}

export type ApiFriendProfile = ApiUser & {
  username: string
  totalAmigos: number
}

export type ApiNotification = {
  _id: string
  type: 'friend_request' | 'friend_accepted' | 'comment_added' | 'collaborator_added'
  read: boolean
  createdAt?: string
  actor?: ApiUser | string
  recipient?: ApiUser | string
  data?: {
    relationId?: string
    capsuleId?: string
    commentId?: string
    role?: string
    message?: string
  }
}

export type ApiFriendRelation = {
  _id: string
  pairKey: string
  status: 'pending' | 'accepted' | 'blocked'
  blockedBy?: string | null
  createdAt?: string
  updatedAt?: string
  requester: ApiUser | string
  recipient: ApiUser | string
  otherUser?: ApiUser | string
  friend?: ApiUser | string
}

export type LoginResponse = {
  token: string
  refreshToken?: string
  user: ApiUser
}

export type RegisterResponse = {
  _id: string
  name: string
  email: string
  avatar?: string
}

export type UploadResponse = {
  fileUrl: string
  fileName: string
  originalName: string
  mimeType: string
  size: number
  type: 'image' | 'video' | 'audio' | 'file' | '3d'
  modelFormat?: '' | 'glb' | 'gltf' | 'obj' | 'fbx' | 'stl'
  thumbnailUrl?: string
}

export type UploadModel3DResponse = {
  fileUrl: string
  thumbnailUrl?: string
  modelFormat?: '' | 'glb' | 'gltf' | 'obj' | 'fbx' | 'stl'
}

export type ApiCapsuleModel = {
  id: string
  nombre: string
  thumbnailUrl: string
  modelUrl: string
}

export function getCapsuleThumb(capsule: ApiCapsule): { thumbnailUrl?: string; modelUrl?: string } {
  const model3D = capsule.mediaItems?.find((m) => m.type === '3d')
  const image = capsule.mediaItems?.find((m) => m.type === 'image')
  const video = capsule.mediaItems?.find((m) => m.type === 'video')

  return {
    thumbnailUrl:
      model3D?.thumbnailUrl ||
      image?.thumbnailUrl ||
      video?.thumbnailUrl ||
      capsule.previewImage ||
      // fallback to video url so frontend can render a <video> preview when no thumbnail exists
      (video ? video.url : undefined) ||
      undefined,
    modelUrl: model3D?.url,
  }
}

function getStoredToken() {
  return sessionStorage.getItem('authToken')
}

function getStoredRefreshToken() {
  return sessionStorage.getItem('refreshToken')
}

function buildHeaders(token?: string, isJsonBody = true) {
  const headers = new Headers()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (isJsonBody) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

async function requestJson<T>(path: string, init: RequestInit = {}, authRequired = true): Promise<T> {
  const token = authRequired ? getStoredToken() : null
  const isFormData = init.body instanceof FormData
  const headers = buildHeaders(token ?? undefined, !isFormData)

  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value)
    })
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  const data = await response.json().catch(() => ({})) as Record<string, unknown>

  if (!response.ok) {
    if (authRequired && response.status === 401 && token) {
      sessionStorage.removeItem('authToken')
      sessionStorage.removeItem('refreshToken')
      sessionStorage.removeItem('authUser')

      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }

    const message = typeof data.message === 'string' ? data.message : 'Request failed'
    throw new Error(message)
  }

  return data as T
}

export function clearSession() {
  sessionStorage.removeItem('authToken')
  sessionStorage.removeItem('refreshToken')
  sessionStorage.removeItem('authUser')
}

export async function loginUser(identifier: string, password: string): Promise<LoginResponse> {
  const data = await requestJson<LoginResponse>('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  }, false)

  return data
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  avatar?: string,
  extra?: {
    birthDate?: string
    country?: string
    gender?: 'male' | 'female' | 'other' | 'prefer_not_say'
  },
): Promise<RegisterResponse> {
  return requestJson<RegisterResponse>('/api/users/register', {
    method: 'POST',
    body: JSON.stringify({
      name,
      email,
      password,
      ...(avatar ? { avatar, profilePhoto: avatar } : {}),
      ...(extra?.birthDate ? { birthDate: extra.birthDate } : {}),
      ...(extra?.country ? { country: extra.country } : {}),
      ...(extra?.gender ? { gender: extra.gender } : {}),
    }),
  }, false)
}

export async function fetchCurrentUser(): Promise<ApiUser> {
  return requestJson<ApiUser>('/api/users/me')
}

export async function updateCurrentUser(payload: {
  name?: string
  email?: string
  profilePhoto?: string
  avatar?: string
  biography?: string
  birthDate?: string | null
  country?: string
  gender?: 'male' | 'female' | 'other' | 'prefer_not_say'
}): Promise<ApiUser> {
  return requestJson<ApiUser>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function updateCurrentUserPreferences(payload: ApiUserPreferences): Promise<ApiUser> {
  return requestJson<ApiUser>('/api/users/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function changeCurrentUserPassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return requestJson<{ message: string }>('/api/users/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function deleteCurrentUser(password: string): Promise<{ message: string }> {
  return requestJson<{ message: string }>('/api/users/me', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  })
}

export async function fetchCapsules(): Promise<ApiCapsule[]> {
  return requestJson<ApiCapsule[]>('/api/capsules')
}

export async function fetchCapsuleById(capsuleId: string): Promise<ApiCapsule> {
  return requestJson<ApiCapsule>(`/api/capsules/${capsuleId}`)
}

export async function fetchCommonCapsules(friendId: string): Promise<ApiCapsule[]> {
  return requestJson<ApiCapsule[]>(`/api/capsules/common/${friendId}`)
}

export async function fetchCapsuleModels(): Promise<ApiCapsuleModel[]> {
  return requestJson<ApiCapsuleModel[]>('/api/capsules/models')
}

export async function fetchFriends(): Promise<ApiFriendRelation[]> {
  return requestJson<ApiFriendRelation[]>('/api/friends')
}

export async function fetchPublicUserFriends(userIdentifier: string): Promise<{ friendCount: number; friends: ApiFriendRelation[] }> {
  return requestJson<{ friendCount: number; friends: ApiFriendRelation[] }>(`/api/friends/public/${encodeURIComponent(userIdentifier)}`)
}

export async function fetchUserById(userId: string): Promise<ApiFriendProfile> {
  return requestJson<ApiFriendProfile>(`/api/users/${userId}`)
}

export async function requestFriendByUsername(username: string): Promise<ApiFriendRelation> {
  const response = await requestJson<{ message: string; relation: ApiFriendRelation }>('/api/friends/request', {
    method: 'POST',
    body: JSON.stringify({ username }),
  })

  return response.relation
}

export async function requestFriendByUserId(userId: string): Promise<ApiFriendRelation> {
  const response = await requestJson<{ message: string; relation: ApiFriendRelation }>('/api/friends/requests', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })

  return response.relation
}

export async function searchUsers(query: string): Promise<ApiUser[]> {
  const encoded = encodeURIComponent(query)
  return requestJson<ApiUser[]>(`/api/users/search?q=${encoded}`)
}

export async function fetchIncomingFriendRequests(): Promise<ApiFriendRelation[]> {
  return requestJson<ApiFriendRelation[]>('/api/friends/requests/incoming')
}

export async function fetchOutgoingFriendRequests(): Promise<ApiFriendRelation[]> {
  return requestJson<ApiFriendRelation[]>('/api/friends/requests/outgoing')
}

export async function acceptFriendRequest(requestId: string): Promise<ApiFriendRelation> {
  const response = await requestJson<{ message: string; relation: ApiFriendRelation }>(`/api/friends/requests/${requestId}/accept`, {
    method: 'POST',
  })

  return response.relation
}

export async function rejectFriendRequest(requestId: string): Promise<{ message: string }> {
  return requestJson<{ message: string }>(`/api/friends/requests/${requestId}/reject`, {
    method: 'POST',
  })
}

export async function createCapsule(payload: {
  title: string
  description?: string
  category?: string
  design?: {
    key?: string
    label?: string
  }
  timeCapsule?: {
    enabled?: boolean
    unlockAt?: string | null
  }
  mediaItems?: ApiMediaItem[]
  previewImage?: string
  collaborators?: Array<{ userId?: string; email?: string; role?: 'admin' | 'edit' | 'view' }>
}) {
  return requestJson<ApiCapsule>('/api/capsules', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function uploadMediaFile(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  return requestJson<UploadResponse>('/api/uploads/media', {
    method: 'POST',
    body: formData,
  })
}

export async function uploadModel3DFile(file: File): Promise<UploadModel3DResponse> {
  const modelFormat = (file.name.split('.').pop()?.toLowerCase() ?? '') as UploadModel3DResponse['modelFormat']

  try {
    const presign = await requestJson<{
      uploadUrl: string
      fileUrl: string
      thumbnailUrl?: string
      modelFormat?: UploadModel3DResponse['modelFormat']
    }>('/api/uploads/media/model3d/presign-upload', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, modelFormat }),
    })

    const uploadResponse = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    })

    if (!uploadResponse.ok) {
      throw new Error('No se pudo subir el modelo 3D')
    }

    return {
      fileUrl: presign.fileUrl,
      thumbnailUrl: presign.thumbnailUrl,
      modelFormat: presign.modelFormat ?? modelFormat,
    }
  } catch (error) {
    const fallback = await uploadMediaFile(file)
    return {
      fileUrl: fallback.fileUrl,
      thumbnailUrl: fallback.thumbnailUrl,
      modelFormat: fallback.modelFormat,
    }
  }
}

export async function fetchNotifications(): Promise<ApiNotification[]> {
  return requestJson<ApiNotification[]>('/api/notifications')
}

export async function getInvite(token: string): Promise<{ capsuleId: string; title: string; role: string }> {
  const response = await fetch(`${API_BASE_URL}/api/invite/${encodeURIComponent(token)}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const message = typeof data.message === 'string' ? data.message : 'Invite not found'
    throw new Error(message)
  }
  return response.json()
}

export async function acceptInvite(token: string): Promise<ApiCapsule> {
  return requestJson<ApiCapsule>(`/api/invite/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
  })
}

export async function fetchUnreadNotificationCount(): Promise<{ unreadCount: number }> {
  return requestJson<{ unreadCount: number }>('/api/notifications/unread/count')
}

export async function markNotificationRead(notificationId: string): Promise<ApiNotification> {
  return requestJson<ApiNotification>(`/api/notifications/${notificationId}/read`, {
    method: 'PUT',
  })
}

export async function markAllNotificationsRead(): Promise<{ message: string }> {
  return requestJson<{ message: string }>('/api/notifications/read/all', {
    method: 'PUT',
  })
}

export async function logoutUser() {
  const refreshToken = getStoredRefreshToken()

  return requestJson<{ message: string }>('/api/users/logout', {
    method: 'POST',
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  })
}

export async function pingServer() {
  const response = await fetch(`${API_BASE_URL}/health`)

  if (!response.ok) {
    throw new Error('No se pudo conectar con el servidor')
  }

  return response.json()
}