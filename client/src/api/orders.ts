import request from './request';

// Order 类型定义
export interface Order {
  _id: string;
  userId: {
    _id: string;
    username: string;
    avatar?: string;
  };
  hotelId: {
    _id: string;
    name: string;
    nameEn?: string;
    city: string;
    address?: string;
  };
  roomTypeId: {
    _id: string;
    title: string;
    price: number;
    stock: number;
    bedInfo?: string;
    size?: string;
  };
  checkInDate: string;
  checkOutDate: string;
  quantity: number;
  totalPrice: number;
  status: 'pending' | 'paid' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

// 商户：获取我的酒店的订单
export const getMerchantOrders = () => {
  return request.get<Order[]>('/api/orders/merchant');
};

// 获取订单详情
export const getOrderDetail = (id: string) => {
  return request.get<Order>(`/api/orders/${id}`);
};
