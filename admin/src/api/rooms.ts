import request from './request';

export interface RoomType {
  _id: string;
  hotelId: string;
  title: string;
  price: number;
  originalPrice?: number;
  capacity: number;
  bedInfo?: string;
  size?: string;
  stock: number;
  images?: string[];
  priceCalendar?: {
    date: string;
    price: number;
    stock?: number;
  }[];
}

export interface RoomTypeCreateData {
  hotelId: string;
  title: string;
  price: number;
  originalPrice?: number;
  capacity?: number;
  bedInfo?: string;
  size?: string;
  stock: number;
  images?: string[];
}

// 添加房型
export const createRoom = (data: RoomTypeCreateData) => {
  return request.post('/api/rooms', data);
};

// 获取酒店的所有房型
export const getRoomsByHotel = (hotelId: string) => {
  return request.get<RoomType[]>(`/api/rooms/${hotelId}`);
};

// 别名导出
export const getHotelRoomTypes = getRoomsByHotel;

// 修改房型
export const updateRoom = (id: string, data: Partial<RoomTypeCreateData>) => {
  return request.put(`/api/rooms/${id}`, data);
};

// 删除房型
export const deleteRoom = (id: string) => {
  return request.delete(`/api/rooms/${id}`);
};

// 获取房型价格日历
export const getRoomCalendar = (id: string) => {
  return request.get<{ basePrice: number; calendar: { date: string; price: number; stock?: number }[] }>(`/api/rooms/${id}/calendar`);
};

// 设置房型价格日历
export const updateRoomCalendar = (id: string, calendarData: { date: string; price: number; stock?: number }[]) => {
  return request.put(`/api/rooms/${id}/calendar`, { calendarData });
};
