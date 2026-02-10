import request from './request'

// 酒店信息接口
export interface Hotel {
  _id: string
  name: string
  nameEn?: string
  city: string
  address: string
  location: {
    type: string
    coordinates: [number, number]
  }
  starRating: number
  price: number
  openingTime?: string
  score: number
  description?: string
  tags: string[]
  images: string[]
  nearbyAttractions?: string[]
  nearbyTransport?: string[]
  nearbyMalls?: string[]
  status: number
  createdAt: string
}

// 房型信息接口
export interface RoomType {
  _id: string
  hotelId: string
  title: string
  price: number
  originalPrice?: number
  capacity: number
  bedInfo?: string
  size?: string
  stock: number
  images: string[]
  priceCalendar: {
    date: string
    price: number
    stock?: number
  }[]
  createdAt: string
}

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

// 分页数据接口
export interface PaginationData<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// 酒店搜索参数
export interface HotelSearchParams {
  city?: string
  keyword?: string
  starRating?: number
  minPrice?: number
  maxPrice?: number
  tags?: string
  checkInDate?: string
  checkOutDate?: string
  sortType?: 'price_asc' | 'price_desc' | 'score_desc' | 'distance'
  userLat?: number
  userLng?: number
  page?: number
  limit?: number
}

// 获取首页轮播图
export function getBanners(): Promise<Banner[]> {
  return request<Banner[]>({ url: '/banners' })
}

// 搜索酒店列表
export function searchHotels(params: HotelSearchParams): Promise<PaginationData<Hotel>> {
  const queryString = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&')

  return request<PaginationData<Hotel>>({
    url: `/hotels${queryString ? `?${queryString}` : ''}`
  })
}

// 获取酒店详情
export function getHotelDetail(id: string): Promise<Hotel> {
  return request<Hotel>({ url: `/hotels/${id}` })
}

// 获取酒店房型列表
export function getHotelRooms(hotelId: string): Promise<RoomType[]> {
  return request<RoomType[]>({ url: `/rooms/${hotelId}` })
}

// 获取房型价格日历
export function getRoomCalendar(roomId: string): Promise<{
  basePrice: number
  calendar: { date: string; price: number; stock?: number }[]
}> {
  return request({ url: `/rooms/${roomId}/calendar` })
}

