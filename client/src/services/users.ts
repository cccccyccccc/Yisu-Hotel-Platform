import request from './request'

// 用户资料接口
export interface UserProfile {
  _id: string
  username: string
  role: 'user' | 'merchant' | 'admin'
  gender?: 'male' | 'female' | 'unknown'
  avatar?: string
  bio?: string
  createdAt?: string
}

// 更新资料参数
export interface UpdateProfileData {
  gender?: 'male' | 'female' | 'unknown'
  avatar?: string
  bio?: string
}

// 修改密码参数
export interface ChangePasswordData {
  oldPassword: string
  newPassword: string
}

// 获取当前用户资料
export function getUserProfile(): Promise<UserProfile> {
  return request<UserProfile>({
    url: '/users/profile',
    method: 'GET'
  })
}

// 更新用户资料（头像/性别/简介）
export function updateUserProfile(data: UpdateProfileData): Promise<UserProfile> {
  return request<UserProfile>({
    url: '/users/profile',
    method: 'PUT',
    data
  })
}

// 修改密码
export function changePassword(data: ChangePasswordData): Promise<{ msg: string }> {
  return request<{ msg: string }>({
    url: '/users/password',
    method: 'PUT',
    data
  })
}

