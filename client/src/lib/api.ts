import ky from "ky"

export const api = ky.create({
  prefixUrl: "/api",
  hooks: {
    beforeRequest: [
      (request) => {
        const token = localStorage.getItem("token")
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`)
        }
      },
    ],
  },
  retry: 0,
  timeout: 30_000,
})

export async function apiGet<T>(url: string): Promise<T> {
  return api.get(url).json<T>()
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  return api.post(url, { json: body }).json<T>()
}

export async function apiPut<T>(url: string, body: unknown): Promise<T> {
  return api.put(url, { json: body }).json<T>()
}

export async function apiDelete(url: string): Promise<void> {
  await api.delete(url)
}
