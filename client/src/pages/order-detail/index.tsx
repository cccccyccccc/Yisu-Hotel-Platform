import { View, Text, Image } from '@tarojs/components'
import { useLoad, useRouter } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { getOrderDetail, cancelOrder, type Order } from '../../services'
import './index.scss'

const BASE_URL = 'http://localhost:5000'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待确认', color: '#faad14', bg: '#fffbe6' },
  confirmed: { label: '已确认', color: '#1890ff', bg: '#e6f7ff' },
  cancelled: { label: '已取消', color: '#999', bg: '#f5f5f5' },
  completed: { label: '已完成', color: '#52c41a', bg: '#f6ffed' },
  rejected: { label: '已拒绝', color: '#ff4d4f', bg: '#fff2f0' },
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${formatDate(dateStr)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

export default function OrderDetail() {
  const router = useRouter()
  const orderId = router.params.id || ''
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useLoad(() => {
    if (orderId) {
      loadOrder()
    }
  })

  const loadOrder = async () => {
    setLoading(true)
    try {
      const data = await getOrderDetail(orderId)
      setOrder(data)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    Taro.showModal({
      title: '取消订单',
      content: '确定要取消此订单吗？此操作不可撤销。',
      success: async (res) => {
        if (res.confirm) {
          try {
            await cancelOrder(orderId)
            Taro.showToast({ title: '订单已取消', icon: 'success' })
            loadOrder()
          } catch {
            Taro.showToast({ title: '取消失败', icon: 'none' })
          }
        }
      },
    })
  }

  const goReview = () => {
    const hotelId = typeof order?.hotel === 'object' ? order.hotel._id : order?.hotel
    Taro.navigateTo({
      url: `/pages/review-create/index?orderId=${orderId}&hotelId=${hotelId}`,
    })
  }

  if (loading) {
    return (
      <View className="loading-page"><Text>加载中...</Text></View>
    )
  }

  if (!order) {
    return (
      <View className="loading-page"><Text>订单不存在</Text></View>
    )
  }

  const hotelName = typeof order.hotel === 'object' ? order.hotel.name : ''
  const hotelAddress = typeof order.hotel === 'object' ? order.hotel.address : ''
  const hotelImage = typeof order.hotel === 'object' ? order.hotel.images?.[0] : ''
  const roomTitle = typeof order.roomType === 'object' ? order.roomType.title : ''
  const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: '#999', bg: '#f5f5f5' }

  const nights = Math.ceil(
    (new Date(order.checkOutDate).getTime() - new Date(order.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <View className="order-detail-page">
      {/* 状态头部 */}
      <View className="status-header" style={{ background: statusInfo.bg }}>
        <Text className="status-label" style={{ color: statusInfo.color }}>{statusInfo.label}</Text>
        {order.status === 'pending' && (
          <Text className="status-hint">等待商户确认您的订单</Text>
        )}
        {order.status === 'confirmed' && (
          <Text className="status-hint">请按时前往酒店办理入住</Text>
        )}
      </View>

      {/* 酒店信息 */}
      <View className="card hotel-card" onClick={() => Taro.navigateTo({ url: `/pages/hotel-detail/index?id=${typeof order.hotel === 'object' ? order.hotel._id : order.hotel}` })}>
        {hotelImage && (
          <Image className="hotel-img" src={getImageUrl(hotelImage)} mode="aspectFill" />
        )}
        <View className="hotel-info">
          <Text className="hotel-name">{hotelName}</Text>
          <Text className="hotel-address">📍 {hotelAddress}</Text>
        </View>
        <Text className="card-arrow">›</Text>
      </View>

      {/* 入住信息 */}
      <View className="card">
        <View className="card-title"><Text>入住信息</Text></View>
        <View className="info-row">
          <Text className="info-label">房型</Text>
          <Text className="info-value">{roomTitle}</Text>
        </View>
        <View className="info-row">
          <Text className="info-label">入住日期</Text>
          <Text className="info-value">{formatDate(order.checkInDate)}</Text>
        </View>
        <View className="info-row">
          <Text className="info-label">离店日期</Text>
          <Text className="info-value">{formatDate(order.checkOutDate)}</Text>
        </View>
        <View className="info-row">
          <Text className="info-label">入住天数</Text>
          <Text className="info-value">{nights}晚</Text>
        </View>
        <View className="info-row">
          <Text className="info-label">房间数量</Text>
          <Text className="info-value">{order.quantity || 1}间</Text>
        </View>
      </View>

      {/* 价格信息 */}
      <View className="card">
        <View className="card-title"><Text>价格信息</Text></View>
        <View className="info-row">
          <Text className="info-label">房费单价</Text>
          <Text className="info-value">¥{order.unitPrice || (order.totalPrice / nights)}/晚</Text>
        </View>
        <View className="info-row total">
          <Text className="info-label">总价</Text>
          <Text className="info-value price">¥{order.totalPrice}</Text>
        </View>
      </View>

      {/* 订单信息 */}
      <View className="card">
        <View className="card-title"><Text>订单信息</Text></View>
        <View className="info-row">
          <Text className="info-label">订单编号</Text>
          <Text className="info-value order-id">{order._id}</Text>
        </View>
        <View className="info-row">
          <Text className="info-label">下单时间</Text>
          <Text className="info-value">{formatDateTime(order.createdAt)}</Text>
        </View>
      </View>

      {/* 底部占位 */}
      <View style={{ height: '160px' }} />

      {/* 底部操作栏 */}
      <View className="action-bar safe-area-bottom">
        {order.status === 'pending' && (
          <View className="action-btn cancel-btn" onClick={handleCancel}>
            <Text>取消订单</Text>
          </View>
        )}
        {order.status === 'completed' && !order.isReviewed && (
          <View className="action-btn review-btn" onClick={goReview}>
            <Text>去评价</Text>
          </View>
        )}
        {order.status === 'completed' && order.isReviewed && (
          <View className="action-btn reviewed-btn">
            <Text>已评价</Text>
          </View>
        )}
      </View>
    </View>
  )
}


