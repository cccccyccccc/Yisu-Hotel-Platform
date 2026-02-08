import request from './request';

export interface MerchantStats {
  hotels: {
    total: number;
    published: number;
    pending: number;
  };
  orders: {
    total: number;
    monthly: number;
    totalRevenue: number;
    monthlyRevenue: number;
  };
  reviews: {
    total: number;
    monthly: number;
    averageRating: number;
  };
  latestReviews: {
    _id: string;
    rating: number;
    content: string;
    createdAt: string;
    user: {
      username: string;
      avatar?: string;
    } | null;
    hotel: {
      name: string;
    } | null;
  }[];
}

// 获取商户统计数据
export const getMerchantStats = () => {
  return request.get<MerchantStats>('/api/merchant/stats');
};

// 获取商户的酒店列表
export const getMerchantHotels = () => {
  return request.get<{ _id: string; name: string; city: string; status: number }[]>('/api/hotels/my');
};
