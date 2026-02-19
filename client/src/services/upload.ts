import { uploadFile } from './request'

// 上传响应
export interface UploadResponse {
  url: string
  msg?: string
}

// 上传图片
export function uploadImage(filePath: string): Promise<UploadResponse> {
  return uploadFile(filePath)
}

