import request from './request';

// Review 类型定义
export interface Review {
  _id: string;
  userId: {
    _id: string;
    username: string;
    avatar?: string;
  };
  hotelId: string;
  rating: number;
  content: string;
  createdAt: string;
}

// 获取酒店评论列表
export const getHotelReviews = (hotelId: string) => {
  return request.get<Review[]>(`/api/reviews/${hotelId}`);
};
