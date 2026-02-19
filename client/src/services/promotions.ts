import request from './request'

// 促销类型
export type PromotionType = 'discount' | 'amount_off' | 'fixed_price'

// 促销接口
export interface Promotion {
  _id: string
  hotelId: string | { _id: string; name: string }
  title: string
  description?: string
  type: PromotionType
  discountValue: number
  minAmount: number
  roomTypes: string[] | { _id: string; title: string }[]
  startDate: string
  endDate: string
  status: number
  createdAt: string
}

// 获取酒店的有效促销列表
export function getHotelPromotions(hotelId: string): Promise<Promotion[]> {
  return request<Promotion[]>({
    url: `/promotions/hotel/${hotelId}`,
    method: 'GET'
  })
}

// 辅助函数：格式化折扣显示
export function formatDiscount(promotion: Promotion): string {
  switch (promotion.type) {
    case 'discount':
      return `${Math.round(promotion.discountValue * 10)}折`
    case 'amount_off':
      return `满${promotion.minAmount}减${promotion.discountValue}`
    case 'fixed_price':
      return `特价¥${promotion.discountValue}`
    default:
      return ''
  }
}

// 辅助函数：计算促销价
export function calculatePromotionPrice(originalPrice: number, promotion: Promotion): number {
  switch (promotion.type) {
    case 'discount':
      return Math.round(originalPrice * promotion.discountValue)
    case 'amount_off':
      if (originalPrice >= promotion.minAmount) {
        return Math.max(0, originalPrice - promotion.discountValue)
      }
      return originalPrice
    case 'fixed_price':
      return promotion.discountValue
    default:
      return originalPrice
  }
}

