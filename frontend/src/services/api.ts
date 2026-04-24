const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'https://momentum-hc2x.onrender.com'

type ApiUser = {
  _id: string
  name: string
  email: string
  avatar?: string
}

type LoginResponse = {
  token: string
  user: ApiUser
}

type RegisterResponse = {
  _id: string
  name: string
  email: string
  avatar?: string
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  const data = (await response.json()) as Partial<LoginResponse> & { message?: string }

  if (!response.ok || !data.token || !data.user) {
    throw new Error(data.message ?? 'No se pudo iniciar sesion')
  }

  return {
    token: data.token,
    user: data.user,
  }
}

export async function registerUser(name: string, email: string, password: string): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE_URL}/api/users/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, email, password }),
  })

  const data = (await response.json()) as Partial<RegisterResponse> & { message?: string }

  if (!response.ok || !data._id || !data.email || !data.name) {
    throw new Error(data.message ?? 'No se pudo crear la cuenta')
  }

  return {
    _id: data._id,
    name: data.name,
    email: data.email,
    avatar: data.avatar,
  }
}

export async function pingServer() {
  const response = await fetch(`${API_BASE_URL}/health`)

  if (!response.ok) {
    throw new Error('No se pudo conectar con el servidor')
  }

  return response.json()
}