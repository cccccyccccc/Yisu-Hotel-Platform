import { uploadFile, request } from './request'
import type { UserProfile } from './users'

// 上传响应
export interface UploadResponse {
  url: string
  msg?: string
}

// 上传图片
export function uploadImage(filePath: string): Promise<UploadResponse> {
  return uploadFile(filePath)
}

// 上传头像并更新用户资料
export async function uploadAvatar(filePath: string): Promise<UserProfile> {
  const uploaded = await uploadFile(filePath)
  return request<UserProfile>({
    url: '/users/profile',
    method: 'PUT',
    data: { avatar: uploaded.url }
  })
}

// 批量上传评价图片，返回可提交到评价接口的 URL 列表
export async function uploadReviewImages(filePaths: string[]): Promise<string[]> {
  const uploads = await Promise.all(filePaths.map((filePath) => uploadFile(filePath)))
  return uploads.map((item) => item.url)
}

