import request from './request'

// 轮播图接口
export interface Banner {
  _id: string
  imageUrl: string
  targetHotelId: {
    _id: string
    name: string
    starRating: number
  }
  title?: string
  priority: number
  status: number
  createdAt: string
}

// 获取首页轮播图（公开）
export function getBanners(): Promise<Banner[]> {
  return request<Banner[]>({
    url: '/banners',
    method: 'GET'
  })
}

