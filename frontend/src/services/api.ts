const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function pingServer() {
  const response = await fetch(`${API_BASE_URL}/health`)

  if (!response.ok) {
    throw new Error('No se pudo conectar con el servidor')
  }

  return response.json()
}