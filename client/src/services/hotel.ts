import request from './request'

// 酒店信息接口
export interface Hotel {
  _id: string
  merchantId?: string
  name: string
  nameEn?: string
  city: string
  address: string
  location?: {
    type: string
    coordinates: [number, number] // [lng, lat]
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
  status: number // 0:待审核, 1:已发布, 2:拒绝, 3:下线
  rejectReason?: string
  createdAt: string
  updatedAt?: string
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
  priceCalendar?: {
    date: string
    price: number
    stock?: number
  }[]
  createdAt?: string
}

// 价格日历项
export interface PriceCalendarItem {
  date: string
  price: number
  stock?: number
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

// 搜索酒店列表（公共）
export function searchHotels(params: HotelSearchParams): Promise<PaginationData<Hotel>> {
  const queryString = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&')

  return request<PaginationData<Hotel>>({
    url: `/hotels${queryString ? `?${queryString}` : ''}`,
    method: 'GET'
  })
}

// 获取酒店详情
export function getHotelDetail(id: string): Promise<Hotel> {
  return request<Hotel>({
    url: `/hotels/${id}`,
    method: 'GET'
  })
}

// 获取酒店房型列表
export function getHotelRooms(hotelId: string): Promise<RoomType[]> {
  return request<RoomType[]>({
    url: `/rooms/${hotelId}`,
    method: 'GET'
  })
}

// 获取房型价格日历
export function getRoomCalendar(roomId: string): Promise<{
  basePrice: number
  calendar: PriceCalendarItem[]
}> {
  return request({
    url: `/rooms/${roomId}/calendar`,
    method: 'GET'
  })
}

