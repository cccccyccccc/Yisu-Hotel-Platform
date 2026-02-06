import request from './request';

// Order 类型定义
export interface Order {
  _id: string;
  userId: {
    _id: string;
    username: string;
  };
  hotelId: {
    _id: string;
    name: string;
    city: string;
  };
  roomTypeId: {
    _id: string;
    title: string;
    price: number;
    stock: number;
  };
  checkInDate: string;
  checkOutDate: string;
  quantity: number;
  totalPrice: number;
  status: 'pending' | 'paid' | 'completed' | 'cancelled';
  createdAt: string;
}

// 商户：获取我的酒店的订单
export const getMerchantOrders = () => {
  return request.get<Order[]>('/api/orders/merchant');
};
