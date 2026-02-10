import { View, Text, Image, Swiper, SwiperItem, ScrollView } from '@tarojs/components'
import { useLoad, useRouter } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getHotelDetail, getHotelRooms, Hotel, RoomType } from '../../services'
import Calendar from '../../components/Calendar'
import './index.scss'

// 设施图标映射
const FACILITY_ICONS: Record<string, string> = {
  '免费停车': '🅿️',
  '免费WiFi': '📶',
  '游泳池': '🏊',
  '健身房': '🏋️',
  '餐厅': '🍽️',
  '会议室': '📊',
  '行李寄存': '🧳',
  '24小时前台': '🏪',
  '接机服务': '🚗',
  '洗衣服务': '👔',
  '温泉': '♨️',
  'SPA': '💆',
  '儿童乐园': '🎠',
  '商务中心': '💼'
}

// 渲染星级
function renderStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

// 格式化日期显示
function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`
}

// 获取默认日期
function getDefaultDates(): { checkIn: string; checkOut: string } {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const formatDate = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return {
    checkIn: formatDate(today),
    checkOut: formatDate(tomorrow)
  }
}

export default function HotelDetail() {
  const router = useRouter()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [rooms, setRooms] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState(false)

  useLoad(() => {
    const { id, checkInDate: inDate, checkOutDate: outDate } = router.params
    if (inDate) setCheckInDate(inDate)
    else {
      const { checkIn } = getDefaultDates()
      setCheckInDate(checkIn)
    }
    if (outDate) setCheckOutDate(outDate)
    else {
      const { checkOut } = getDefaultDates()
      setCheckOutDate(checkOut)
    }

    if (id) {
      loadHotelData(id)
    }
  })

  // 加载酒店数据
  const loadHotelData = async (hotelId: string) => {
    setLoading(true)
    try {
      const [hotelData, roomsData] = await Promise.all([
        getHotelDetail(hotelId),
        getHotelRooms(hotelId)
      ])
      setHotel(hotelData)
      // 按价格从低到高排序
      setRooms(roomsData.sort((a, b) => a.price - b.price))

      // 设置导航栏标题
      Taro.setNavigationBarTitle({ title: hotelData.name })
    } catch (error) {
      console.error('加载酒店详情失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 返回列表
  const handleBack = () => {
    Taro.navigateBack()
  }

  // 计算入住晚数
  const getNights = (): number => {
    if (!checkInDate || !checkOutDate) return 1
    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
  }

  // 日历确认
  const handleCalendarConfirm = (checkIn: string, checkOut: string) => {
    setCheckInDate(checkIn)
    setCheckOutDate(checkOut)
  }

  // 预览图片
  const handleImagePreview = (index: number) => {
    if (hotel?.images && hotel.images.length > 0) {
      Taro.previewImage({
        current: hotel.images[index],
        urls: hotel.images
      })
    }
  }

  // 查看房型
  const handleViewRoom = (room: RoomType) => {
    Taro.showToast({
      title: `预订 ${room.title}`,
      icon: 'none'
    })
    // TODO: 跳转到预订页面
  }

  const nights = getNights()

  if (loading) {
    return (
      <View className="loading-container">
        <Text>加载中...</Text>
      </View>
    )
  }

  if (!hotel) {
    return (
      <View className="error-container">
        <Text>酒店信息不存在</Text>
      </View>
    )
  }

  return (
    <View className="hotel-detail-page">
      {/* 顶部导航 */}
      <View className="nav-header">
        <View className="nav-back" onClick={handleBack}>
          <Text className="back-icon">‹</Text>
        </View>
        <Text className="nav-title" numberOfLines={1}>{hotel.name}</Text>
        <View className="nav-placeholder" />
      </View>

      <ScrollView className="detail-scroll" scrollY enhanced showScrollbar={false}>
        {/* 图片轮播 */}
        <View className="image-banner">
          <Swiper
            className="image-swiper"
            circular
            autoplay
            interval={4000}
            onChange={(e) => setCurrentImageIndex(e.detail.current)}
          >
            {hotel.images && hotel.images.length > 0 ? (
              hotel.images.map((img, index) => (
                <SwiperItem key={index} onClick={() => handleImagePreview(index)}>
                  <Image className="hotel-image" src={img} mode="aspectFill" />
                </SwiperItem>
              ))
            ) : (
              <SwiperItem>
                <View className="image-placeholder">
                  <Text>暂无图片</Text>
                </View>
              </SwiperItem>
            )}
          </Swiper>
          <View className="image-indicator">
            <Text>{currentImageIndex + 1}/{hotel.images?.length || 1}</Text>
          </View>
          <View className="image-nav">
            <View className="nav-item active">封面</View>
            <View className="nav-item">精选</View>
            <View className="nav-item">位置</View>
            <View className="nav-item">相册 ›</View>
          </View>
        </View>

        {/* 酒店基础信息 */}
        <View className="hotel-info-section">
          <View className="hotel-name-row">
            <Text className="hotel-name">{hotel.name}</Text>
            <View className="hotel-star">
              <Text className="star-text">{renderStars(hotel.starRating)}</Text>
            </View>
          </View>

          {/* 评分行 */}
          <View className="hotel-score-row">
            <View className="score-badge">
              <Text className="score-num">{hotel.score?.toFixed(1) || '5.0'}</Text>
            </View>
            <Text className="score-label">
              {hotel.score >= 4.5 ? '超棒' : hotel.score >= 4 ? '很好' : '不错'}
            </Text>
            <Text className="review-count">4695条点评</Text>
          </View>

          {/* 设施信息 */}
          <View className="hotel-facilities">
            {hotel.openingTime && (
              <View className="facility-item">
                <Text className="facility-icon">🏢</Text>
                <Text className="facility-text">{hotel.openingTime}开业</Text>
              </View>
            )}
            {hotel.tags && hotel.tags.slice(0, 4).map((tag, index) => (
              <View key={index} className="facility-item">
                <Text className="facility-icon">{FACILITY_ICONS[tag] || '✓'}</Text>
                <Text className="facility-text">{tag}</Text>
              </View>
            ))}
          </View>

          {/* 地址 */}
          <View className="hotel-address">
            <Text className="address-icon">📍</Text>
            <Text className="address-text">{hotel.address}</Text>
          </View>

          {/* 附近信息 */}
          {hotel.nearbyTransport && hotel.nearbyTransport.length > 0 && (
            <View className="nearby-info">
              <Text className="nearby-icon">🚇</Text>
              <Text className="nearby-text">{hotel.nearbyTransport[0]}</Text>
            </View>
          )}
        </View>

        {/* 日历选择 Banner */}
        <View className="date-banner" onClick={() => setShowCalendar(true)}>
          <View className="date-content">
            <View className="date-item">
              <Text className="date-label">入住</Text>
              <Text className="date-value">{formatDateDisplay(checkInDate)}</Text>
            </View>
            <View className="date-nights">
              <Text className="nights-num">{nights}</Text>
              <Text className="nights-text">晚</Text>
            </View>
            <View className="date-item">
              <Text className="date-label">离店</Text>
              <Text className="date-value">{formatDateDisplay(checkOutDate)}</Text>
            </View>
          </View>
          <View className="date-tip">
            <Text>●</Text>
            <Text className="tip-text">当前已过0点，如需今天凌晨6点前入住，请选择"今天凌晨"</Text>
          </View>
        </View>

        {/* 筛选标签 */}
        <View className="filter-tags">
          <View className="tag-scroll">
            <View className="tag-item">含早餐</View>
            <View className="tag-item">立即确认</View>
            <View className="tag-item">大床房</View>
            <View className="tag-item">双床房</View>
            <View className="tag-item">免费取消</View>
            <View className="tag-item">筛选</View>
          </View>
        </View>

        {/* 房型列表 */}
        <View className="room-list-section">
          <View className="section-title">
            <Text>房型价格</Text>
          </View>

          {rooms.map((room) => (
            <View key={room._id} className="room-card">
              <View className="room-main">
                <Image
                  className="room-image"
                  src={room.images?.[0] || '/assets/default-room.png'}
                  mode="aspectFill"
                />
                <View className="room-info">
                  <View className="room-name-row">
                    <Text className="room-name">{room.title}</Text>
                    {room.stock > 0 && room.stock <= 3 && (
                      <Text className="room-stock">仅剩{room.stock}间</Text>
                    )}
                  </View>
                  <View className="room-specs">
                    {room.bedInfo && <Text className="spec-item">{room.bedInfo}</Text>}
                    {room.size && <Text className="spec-item">{room.size}</Text>}
                    <Text className="spec-item">{room.capacity}人入住</Text>
                  </View>
                </View>
              </View>

              <View className="room-price-row">
                <View className="price-left">
                  {room.originalPrice && room.originalPrice > room.price && (
                    <Text className="original-price">¥{room.originalPrice}</Text>
                  )}
                </View>
                <View className="price-right">
                  <View className="current-price">
                    <Text className="price-symbol">¥</Text>
                    <Text className="price-num">{room.price}</Text>
                    <Text className="price-unit">起</Text>
                  </View>
                  <View
                    className={`book-btn ${room.stock <= 0 ? 'disabled' : ''}`}
                    onClick={() => room.stock > 0 && handleViewRoom(room)}
                  >
                    <Text>{room.stock > 0 ? '查看房型' : '已满房'}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}

          {rooms.length === 0 && (
            <View className="empty-rooms">
              <Text>暂无可预订房型</Text>
            </View>
          )}
        </View>

        {/* 底部占位 */}
        <View className="bottom-placeholder" />
      </ScrollView>

      {/* 底部操作栏 */}
      <View className="bottom-bar">
        <View className="bar-left">
          <View className="bar-item">
            <Text className="bar-icon">💬</Text>
            <Text className="bar-text">问酒店</Text>
          </View>
          <View className="bar-item">
            <Text className="bar-icon">❤️</Text>
            <Text className="bar-text">收藏</Text>
          </View>
        </View>
        <View className="bar-right">
          <View className="min-price">
            <Text className="price-label">¥</Text>
            <Text className="price-value">{hotel.price}</Text>
            <Text className="price-suffix">起</Text>
          </View>
          <View className="book-button" onClick={() => setShowCalendar(true)}>
            <Text>查看房型</Text>
          </View>
        </View>
      </View>

      {/* 日历组件 */}
      <Calendar
        visible={showCalendar}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        onClose={() => setShowCalendar(false)}
        onConfirm={handleCalendarConfirm}
      />
    </View>
  )
}

