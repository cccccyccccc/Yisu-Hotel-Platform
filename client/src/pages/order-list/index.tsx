import { View, Text, Image } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { getMyOrders, cancelOrder, type Order } from '../../services'
import './index.scss'

const BASE_URL = 'http://localhost:5000'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待确认', color: '#faad14' },
  confirmed: { label: '已确认', color: '#1890ff' },
  cancelled: { label: '已取消', color: '#999' },
  completed: { label: '已完成', color: '#52c41a' },
  rejected: { label: '已拒绝', color: '#ff4d4f' },
}

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待确认' },
  { key: 'confirmed', label: '已确认' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
]

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

export default function OrderList() {
  const [orders, setOrders] = useState<Order[]>([])
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => Taro.redirectTo({ url: '/pages/login/index' }), 1500)
      return
    }
    loadOrders()
  })

  const loadOrders = async () => {
    setLoading(true)
    try {
      const data = await getMyOrders()
      setOrders(data)
    } catch {
      console.error('获取订单列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = (orderId: string) => {
    Taro.showModal({
      title: '取消订单',
      content: '确定要取消此订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await cancelOrder(orderId)
            Taro.showToast({ title: '订单已取消', icon: 'success' })
            loadOrders()
          } catch {
            Taro.showToast({ title: '取消失败', icon: 'none' })
          }
        }
      },
    })
  }

  const goDetail = (orderId: string) => {
    Taro.navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })
  }

  const filteredOrders = activeTab === 'all'
    ? orders
    : orders.filter(o => o.status === activeTab)

  return (
    <View className="order-list-page">
      {/* Tab 筛选 */}
      <View className="tab-bar">
        {TABS.map(tab => (
          <View
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text>{tab.label}</Text>
          </View>
        ))}
      </View>

      {/* 订单列表 */}
      <View className="order-list">
        {loading ? (
          <View className="empty-state"><Text>加载中...</Text></View>
        ) : filteredOrders.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-icon">📭</Text>
            <Text className="empty-text">暂无订单</Text>
          </View>
        ) : (
          filteredOrders.map(order => {
            const hotelName = typeof order.hotel === 'object' ? order.hotel.name : ''
            const hotelImage = typeof order.hotel === 'object' ? order.hotel.images?.[0] : ''
            const roomTitle = typeof order.roomType === 'object' ? order.roomType.title : ''
            const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: '#999' }

            return (
              <View key={order._id} className="order-card" onClick={() => goDetail(order._id)}>
                <View className="order-header">
                  <Text className="order-hotel-name">{hotelName}</Text>
                  <Text className="order-status" style={{ color: statusInfo.color }}>
                    {statusInfo.label}
                  </Text>
                </View>
                <View className="order-body">
                  {hotelImage && (
                    <Image
                      className="order-img"
                      src={getImageUrl(hotelImage)}
                      mode="aspectFill"
                    />
                  )}
                  <View className="order-info">
                    <Text className="order-room">{roomTitle}</Text>
                    <Text className="order-dates">
                      {formatDate(order.checkInDate)} ~ {formatDate(order.checkOutDate)}
                    </Text>
                    <Text className="order-price">¥{order.totalPrice}</Text>
                  </View>
                </View>
                <View className="order-footer">
                  <Text className="order-time">
                    下单时间：{formatDate(order.createdAt)}
                  </Text>
                  <View className="order-actions">
                    {order.status === 'pending' && (
                      <View
                        className="action-btn cancel"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCancel(order._id)
                        }}
                      >
                        <Text>取消订单</Text>
                      </View>
                    )}
                    {order.status === 'completed' && !order.isReviewed && (
                      <View
                        className="action-btn review"
                        onClick={(e) => {
                          e.stopPropagation()
                          Taro.navigateTo({
                            url: `/pages/review-create/index?orderId=${order._id}&hotelId=${typeof order.hotel === 'object' ? order.hotel._id : order.hotel}`,
                          })
                        }}
                      >
                        <Text>去评价</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )
          })
        )}
      </View>
    </View>
  )
}


