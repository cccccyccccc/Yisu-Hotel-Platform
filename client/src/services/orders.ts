import request from './request'

// 订单状态类型
export type OrderStatus = 'pending' | 'paid' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'

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
  // 兼容页面层旧字段
  hotel?: Order['hotelId']
  roomType?: Order['roomTypeId']
  unitPrice?: number
  isReviewed?: boolean
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

interface ServerOrder {
  _id: string
  userId: Order['userId'] | string
  hotelId: Order['hotelId'] | string
  roomTypeId: Order['roomTypeId'] | string
  checkInDate: string
  checkOutDate: string
  quantity: number
  totalPrice: number
  status: OrderStatus
  createdAt: string
  updatedAt?: string
}

function normalizeOrder(serverOrder: ServerOrder): Order {
  const nights = Math.max(
    1,
    Math.ceil(
      (new Date(serverOrder.checkOutDate).getTime() - new Date(serverOrder.checkInDate).getTime())
      / (1000 * 60 * 60 * 24)
    )
  )
  const unitPriceFromRoom = typeof serverOrder.roomTypeId === 'object'
    ? serverOrder.roomTypeId.price
    : undefined
  const unitPrice = unitPriceFromRoom ?? Math.round(serverOrder.totalPrice / Math.max(1, serverOrder.quantity * nights))

  const order: Order = {
    ...serverOrder,
    userId: serverOrder.userId as Order['userId'],
    hotelId: serverOrder.hotelId as Order['hotelId'],
    roomTypeId: serverOrder.roomTypeId as Order['roomTypeId'],
    hotel: serverOrder.hotelId as Order['hotelId'],
    roomType: serverOrder.roomTypeId as Order['roomTypeId'],
    unitPrice,
    isReviewed: false
  }
  return order
}

// 创建订单
export async function createOrder(data: CreateOrderData): Promise<Order> {
  const result = await request<ServerOrder>({
    url: '/orders',
    method: 'POST',
    data
  })
  return normalizeOrder(result)
}

// 获取我的订单列表
export async function getMyOrders(): Promise<Order[]> {
  const result = await request<ServerOrder[]>({
    url: '/orders/my',
    method: 'GET'
  })
  return result.map(normalizeOrder)
}

// 取消订单
export async function cancelOrder(orderId: string): Promise<Order> {
  const result = await request<ServerOrder>({
    url: `/orders/${orderId}/cancel`,
    method: 'PUT'
  })
  return normalizeOrder(result)
}

// 获取订单详情
export async function getOrderDetail(orderId: string): Promise<Order> {
  const result = await request<ServerOrder>({
    url: `/orders/${orderId}`,
    method: 'GET'
  })
  return normalizeOrder(result)
}
