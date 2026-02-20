import { View, Text, Image } from '@tarojs/components'
import { useLoad, useRouter } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import {
  getHotelDetail, getHotelRooms, createOrder,
  getHotelPromotions, calculatePromotionPrice, formatDiscount,
  type Hotel, type RoomType, type Promotion,
} from '../../services'
import './index.scss'

const BASE_URL = 'http://localhost:5000'

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`
}

function getImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

export default function OrderCreate() {
  const router = useRouter()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [room, setRoom] = useState<RoomType | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [quantity, setQuantity] = useState(1)

  const checkInDate = router.params.checkInDate || ''
  const checkOutDate = router.params.checkOutDate || ''
  const hotelId = router.params.hotelId || ''
  const roomId = router.params.roomId || ''

  useLoad(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => Taro.redirectTo({ url: '/pages/login/index' }), 1500)
      return
    }
    if (hotelId && roomId) {
      loadData()
    }
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const [hotelData, roomsData, promoData] = await Promise.all([
        getHotelDetail(hotelId),
        getHotelRooms(hotelId),
        getHotelPromotions(hotelId),
      ])
      setHotel(hotelData)
      const targetRoom = roomsData.find(r => r._id === roomId)
      setRoom(targetRoom || null)
      setPromotions(promoData)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const getNights = (): number => {
    if (!checkInDate || !checkOutDate) return 1
    return Math.ceil(
      (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  }

  const getPrice = () => {
    if (!room) return { unitPrice: 0, totalPrice: 0, promotion: null as Promotion | null }
    let unitPrice = room.price
    let matchedPromo: Promotion | null = null

    for (const promo of promotions) {
      const roomTypeIds = (promo.roomTypes as Array<string | { _id: string }>).map(
        rt => typeof rt === 'string' ? rt : rt._id
      )
      if (roomTypeIds.length === 0 || roomTypeIds.includes(room._id)) {
        const promoPrice = calculatePromotionPrice(unitPrice, promo)
        if (promoPrice < unitPrice) {
          unitPrice = promoPrice
          matchedPromo = promo
        }
      }
    }

    return {
      unitPrice,
      totalPrice: unitPrice * quantity * getNights(),
      promotion: matchedPromo,
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await createOrder({
        hotelId,
        roomTypeId: roomId,
        checkInDate,
        checkOutDate,
        quantity,
      })
      Taro.showToast({ title: '预订成功！', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/order-list/index' })
      }, 1500)
    } catch (error) {
      console.error('下单失败:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View className="loading-page">
        <Text>加载中...</Text>
      </View>
    )
  }

  const nights = getNights()
  const { unitPrice, totalPrice, promotion } = getPrice()

  return (
    <View className="order-create-page">
      {/* 酒店信息 */}
      <View className="hotel-card">
        <Image
          className="hotel-img"
          src={getImageUrl(hotel?.images?.[0] || '')}
          mode="aspectFill"
        />
        <View className="hotel-info">
          <Text className="hotel-name">{hotel?.name}</Text>
          <Text className="hotel-address">📍 {hotel?.address}</Text>
        </View>
      </View>

      {/* 入住信息 */}
      <View className="info-card">
        <View className="info-title">
          <Text>入住信息</Text>
        </View>
        <View className="date-row">
          <View className="date-item">
            <Text className="date-label">入住</Text>
            <Text className="date-value">{formatDateDisplay(checkInDate)}</Text>
          </View>
          <View className="date-nights">
            <Text className="nights-num">{nights}晚</Text>
          </View>
          <View className="date-item">
            <Text className="date-label">离店</Text>
            <Text className="date-value">{formatDateDisplay(checkOutDate)}</Text>
          </View>
        </View>

        <View className="room-info-row">
          <Text className="room-name">{room?.title}</Text>
          <View className="room-specs">
            {room?.bedInfo && <Text className="spec">{room.bedInfo}</Text>}
            {room?.size && <Text className="spec">{room.size}</Text>}
            <Text className="spec">{room?.capacity}人入住</Text>
          </View>
        </View>

        {/* 数量选择 */}
        <View className="quantity-row">
          <Text className="quantity-label">房间数量</Text>
          <View className="quantity-control">
            <View
              className={`qty-btn ${quantity <= 1 ? 'disabled' : ''}`}
              onClick={() => quantity > 1 && setQuantity(q => q - 1)}
            >
              <Text>−</Text>
            </View>
            <Text className="qty-num">{quantity}</Text>
            <View
              className={`qty-btn ${quantity >= (room?.stock || 1) ? 'disabled' : ''}`}
              onClick={() => quantity < (room?.stock || 1) && setQuantity(q => q + 1)}
            >
              <Text>+</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 价格明细 */}
      <View className="info-card">
        <View className="info-title"><Text>价格明细</Text></View>
        <View className="price-detail-row">
          <Text className="detail-label">房费单价</Text>
          <Text className="detail-value">¥{room?.price}/晚</Text>
        </View>
        {promotion && (
          <View className="price-detail-row promo">
            <Text className="detail-label">🏷️ {promotion.title}</Text>
            <Text className="detail-value promo-text">{formatDiscount(promotion)}</Text>
          </View>
        )}
        <View className="price-detail-row">
          <Text className="detail-label">入住 {nights} 晚 × {quantity} 间</Text>
          <Text className="detail-value">¥{unitPrice} × {nights} × {quantity}</Text>
        </View>
        <View className="price-total-row">
          <Text className="total-label">合计</Text>
          <View className="total-price">
            <Text className="price-symbol">¥</Text>
            <Text className="price-amount">{totalPrice}</Text>
          </View>
        </View>
      </View>

      {/* 底部占位 */}
      <View style={{ height: '160px' }} />

      {/* 底部提交 */}
      <View className="submit-bar safe-area-bottom">
        <View className="submit-left">
          <Text className="submit-price-label">总价 </Text>
          <Text className="submit-price-symbol">¥</Text>
          <Text className="submit-price-num">{totalPrice}</Text>
        </View>
        <View
          className={`submit-btn ${submitting ? 'disabled' : ''}`}
          onClick={!submitting ? handleSubmit : undefined}
        >
          <Text>{submitting ? '提交中...' : '确认预订'}</Text>
        </View>
      </View>
    </View>
  )
}


