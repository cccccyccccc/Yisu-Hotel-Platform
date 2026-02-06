import request from './request';

export interface Hotel {
  _id: string;
  merchantId: string;
  name: string;
  nameEn?: string;
  city: string;
  address: string;
  starRating: number;
  score?: number;
  price: number;
  openingTime?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  description?: string;
  tags?: string[];
  images?: string[];
  nearbyAttractions?: string[];
  nearbyTransport?: string[];
  nearbyMalls?: string[];
  status: 0 | 1 | 2 | 3; // 0:待审核, 1:已发布, 2:拒绝, 3:下线
  rejectReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HotelCreateData {
  name: string;
  nameEn?: string;
  city: string;
  address: string;
  starRating: number;
  price: number;
  openingTime?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  description?: string;
  tags?: string[];
  images?: string[];
  nearbyAttractions?: string[];
  nearbyTransport?: string[];
  nearbyMalls?: string[];
}

// 商户：发布新酒店
export const createHotel = (data: HotelCreateData) => {
  return request.post('/api/hotels', data);
};

// 商户：获取我的酒店列表
export const getMyHotels = () => {
  return request.get<Hotel[]>('/api/hotels/my');
};

// 商户：修改酒店信息
export const updateHotel = (id: string, data: Partial<HotelCreateData>) => {
  return request.put(`/api/hotels/${id}`, data);
};

// 管理员：获取所有酒店列表
export const getAdminHotelList = () => {
  return request.get<Hotel[]>('/api/hotels/admin/list');
};

// 管理员：审核酒店
export const auditHotel = (id: string, data: { status: 1 | 2; rejectReason?: string }) => {
  return request.put(`/api/hotels/${id}/audit`, data);
};

// 酒店上下线
export const updateHotelStatus = (id: string, status: 1 | 3) => {
  return request.put(`/api/hotels/${id}/status`, { status });
};

// 获取酒店详情
export const getHotelDetail = (id: string) => {
  return request.get<Hotel>(`/api/hotels/${id}`);
};
