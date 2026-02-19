import request from './request'

// 评价接口
export interface Review {
  _id: string
  userId: {
    _id: string
    username: string
    avatar?: string
  }
  hotelId: string
  orderId?: string
  rating: number
  content: string
  images?: string[]
  reply?: string
  replyAt?: string
  createdAt: string
}

// 发布评价参数
export interface CreateReviewData {
  hotelId: string
  orderId?: string
  rating: number
  content: string
  images?: string[]
}

// 发布评价
export function createReview(data: CreateReviewData): Promise<{ msg: string; review: Review }> {
  return request<{ msg: string; review: Review }>({
    url: '/reviews',
    method: 'POST',
    data
  })
}

// 获取某酒店的所有评价
export function getHotelReviews(hotelId: string): Promise<Review[]> {
  return request<Review[]>({
    url: `/reviews/${hotelId}`,
    method: 'GET'
  })
}
