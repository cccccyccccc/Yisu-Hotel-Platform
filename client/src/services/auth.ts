import request from './request'

export interface LoginData {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  password: string
  role?: 'user' | 'merchant' | 'admin'
  captchaToken: string
  gender?: 'male' | 'female' | 'unknown'
  bio?: string
}

export interface User {
  _id: string
  username: string
  role: 'user' | 'merchant' | 'admin'
  gender?: string
  avatar?: string
  bio?: string
  createdAt?: string
}

export interface LoginResponse {
  token: string
  user: User
}

// 用户登录
export function login(data: LoginData): Promise<LoginResponse> {
  return request<LoginResponse>({
    url: '/auth/login',
    method: 'POST',
    data
  })
}

// 用户注册
export function register(data: RegisterData): Promise<void> {
  return request<void>({
    url: '/auth/register',
    method: 'POST',
    data
  })
}

