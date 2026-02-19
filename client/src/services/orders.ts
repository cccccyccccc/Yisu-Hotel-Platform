import request from './request'

// 订单状态类型
export type OrderStatus = 'pending' | 'paid' | 'completed' | 'cancelled'

// 订单信息接口
export interface Order {
  _id: string
  userId: {
    _id: string
    username: string
    avatar?: string
  }
  hotelId: {
    _id: string
    name: string
    nameEn?: string
    city: string
    address?: string
    images?: string[]
  }
  roomTypeId: {
    _id: string
    title: string
    price: number
    stock: number
    bedInfo?: string
    size?: string
    images?: string[]
  }
  checkInDate: string
  checkOutDate: string
  quantity: number
  totalPrice: number
  status: OrderStatus
  createdAt: string
  updatedAt?: string
}

// 创建订单参数
export interface CreateOrderData {
  hotelId: string
  roomTypeId: string
  checkInDate: string
  checkOutDate: string
  quantity: number
}

// 订单列表响应
export interface OrderListResponse {
  data: Order[]
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// 创建订单
export function createOrder(data: CreateOrderData): Promise<{ msg: string; order: Order }> {
  return request<{ msg: string; order: Order }>({
    url: '/orders',
    method: 'POST',
    data
  })
}

// 获取我的订单列表
export function getMyOrders(): Promise<Order[]> {
  return request<Order[]>({
    url: '/orders/my',
    method: 'GET'
  })
}

// 取消订单
export function cancelOrder(orderId: string): Promise<{ msg: string }> {
  return request<{ msg: string }>({
    url: `/orders/${orderId}/cancel`,
    method: 'PUT'
  })
}

// 获取订单详情
export function getOrderDetail(orderId: string): Promise<Order> {
  return request<Order>({
    url: `/orders/${orderId}`,
    method: 'GET'
  })
}
