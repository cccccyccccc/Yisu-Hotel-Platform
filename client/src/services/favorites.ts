import request from './request'

// 收藏的酒店信息
export interface FavoriteHotel {
  _id: string
  name: string
  nameEn?: string
  city: string
  address: string
  starRating: number
  price: number
  score: number
  images: string[]
  tags: string[]
}

// 收藏项接口
export interface Favorite {
  _id: string
  userId: string
  hotelId: FavoriteHotel
  createdAt: string
}

export interface MyFavoriteHotel extends FavoriteHotel {
  minPrice: number
  rating: number
}

// 收藏状态检查响应
export interface FavoriteCheckResponse {
  isFavorite: boolean
}

// 获取我的收藏列表
export function getFavorites(): Promise<Favorite[]> {
  return request<Favorite[]>({
    url: '/favorites',
    method: 'GET'
  })
}

// 获取我的收藏列表（页面直接使用酒店列表结构）
export async function getMyFavorites(): Promise<MyFavoriteHotel[]> {
  const favorites = await getFavorites()
  return favorites
    .map((item) => item.hotelId)
    .filter(Boolean)
    .map((hotel) => ({
      ...hotel,
      minPrice: hotel.price,
      rating: hotel.score
    }))
}

// 收藏酒店
export function addFavorite(hotelId: string): Promise<{ msg: string }> {
  return request<{ msg: string }>({
    url: `/favorites/${hotelId}`,
    method: 'POST'
  })
}

// 取消收藏
export function removeFavorite(hotelId: string): Promise<{ msg: string }> {
  return request<{ msg: string }>({
    url: `/favorites/${hotelId}`,
    method: 'DELETE'
  })
}

// 检查是否已收藏（用于前端UI状态）
export function checkFavorite(hotelId: string): Promise<FavoriteCheckResponse> {
  return request<FavoriteCheckResponse>({
    url: `/favorites/check/${hotelId}`,
    method: 'GET'
  })
}
