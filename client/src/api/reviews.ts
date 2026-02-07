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

// 商户评价类型（包含酒店信息）
export interface MerchantReview {
  _id: string;
  userId: {
    _id: string;
    username: string;
    avatar?: string;
  };
  hotelId: {
    _id: string;
    name: string;
    city?: string;
  };
  rating: number;
  content: string;
  reply?: string;
  replyAt?: string;
  createdAt: string;
}

// 获取酒店评论列表
export const getHotelReviews = (hotelId: string) => {
  return request.get<Review[]>(`/api/reviews/${hotelId}`);
};

// 商户：获取我的酒店的所有评价
export const getMerchantReviews = () => {
  return request.get<MerchantReview[]>('/api/reviews/merchant/all');
};

// 商户：回复评价
export const replyToReview = (reviewId: string, reply: string) => {
  return request.put<{ msg: string; review: MerchantReview }>(`/api/reviews/${reviewId}/reply`, { reply });
};
