import request from './request';

// 促销类型
export interface Promotion {
  _id: string;
  hotelId: string | { _id: string; name: string };
  title: string;
  description?: string;
  type: 'discount' | 'amount_off' | 'fixed_price';
  discountValue: number;
  minAmount: number;
  roomTypes: string[] | { _id: string; title: string }[];
  startDate: string;
  endDate: string;
  status: number;
  createdAt: string;
}

// 获取酒店的有效促销
export const getHotelPromotions = (hotelId: string) => {
  return request.get<Promotion[]>(`/api/promotions/hotel/${hotelId}`);
};

// 商户：获取自己的促销列表
export const getMyPromotions = () => {
  return request.get<Promotion[]>('/api/promotions/my');
};

// 商户：创建促销
export const createPromotion = (data: {
  hotelId: string;
  title: string;
  description?: string;
  type: 'discount' | 'amount_off' | 'fixed_price';
  discountValue: number;
  minAmount?: number;
  roomTypes?: string[];
  startDate: string;
  endDate: string;
}) => {
  return request.post('/api/promotions', data);
};

// 商户：更新促销
export const updatePromotion = (id: string, data: Partial<Promotion>) => {
  return request.put(`/api/promotions/${id}`, data);
};

// 商户：删除促销
export const deletePromotion = (id: string) => {
  return request.delete(`/api/promotions/${id}`);
};

// 辅助函数：格式化折扣显示
export const formatDiscount = (promotion: Promotion): string => {
  switch (promotion.type) {
    case 'discount':
      return `${Math.round(promotion.discountValue * 10)}折`;
    case 'amount_off':
      return `满${promotion.minAmount}减${promotion.discountValue}`;
    case 'fixed_price':
      return `特价¥${promotion.discountValue}`;
    default:
      return '';
  }
};

// 辅助函数：计算促销价
export const calculatePromotionPrice = (originalPrice: number, promotion: Promotion): number => {
  switch (promotion.type) {
    case 'discount':
      return Math.round(originalPrice * promotion.discountValue);
    case 'amount_off':
      if (originalPrice >= promotion.minAmount) {
        return Math.max(0, originalPrice - promotion.discountValue);
      }
      return originalPrice;
    case 'fixed_price':
      return promotion.discountValue;
    default:
      return originalPrice;
  }
};
