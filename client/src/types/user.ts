export interface User {
  id: string
  name: string | null
  email: string
  profile_picture: string | null
}

export interface SignInRequest {
  email: string
  password: string
}

export interface SignInResponse {
  token: string
  account: User
}
