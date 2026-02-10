import { View, Text, Image, Swiper, SwiperItem, Input } from '@tarojs/components'
import { useLoad, useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getBanners, Banner } from '../../services'
import Calendar from '../../components/Calendar'
import './index.scss'

// 快捷标签配置
const QUICK_TAGS = [
  { id: '1', name: '免费停车', icon: '🅿️' },
  { id: '2', name: '亲子酒店', icon: '👨‍👩‍👧' },
  { id: '3', name: '豪华型', icon: '⭐' },
  { id: '4', name: '温泉', icon: '♨️' },
  { id: '5', name: '海景房', icon: '🌊' },
  { id: '6', name: '免费早餐', icon: '🍳' },
  { id: '7', name: '宠物友好', icon: '🐕' },
  { id: '8', name: '健身房', icon: '🏋️' }
]

// 星级筛选配置
const STAR_OPTIONS = [
  { value: '', label: '不限' },
  { value: '5', label: '五星/豪华' },
  { value: '4', label: '四星/高档' },
  { value: '3', label: '三星/舒适' },
  { value: '2', label: '经济型' }
]

// 价格筛选配置
const PRICE_OPTIONS = [
  { value: '', label: '不限', min: undefined, max: undefined },
  { value: '0-200', label: '¥200以下', min: 0, max: 200 },
  { value: '200-400', label: '¥200-400', min: 200, max: 400 },
  { value: '400-700', label: '¥400-700', min: 400, max: 700 },
  { value: '700+', label: '¥700以上', min: 700, max: undefined }
]

// 格式化日期显示
function formatDateDisplay(dateStr: string): { month: string; day: string; weekday: string } {
  if (!dateStr) return { month: '', day: '', weekday: '' }
  const date = new Date(dateStr)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return {
    month: `${date.getMonth() + 1}月`,
    day: `${date.getDate()}`,
    weekday: weekdays[date.getDay()]
  }
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

export default function Index() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [city, setCity] = useState('上海')
  const [keyword, setKeyword] = useState('')
  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [starRating, setStarRating] = useState('')
  const [priceRange, setPriceRange] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [showStarPicker, setShowStarPicker] = useState(false)
  const [showPricePicker, setShowPricePicker] = useState(false)

  useLoad(() => {
    console.log('首页加载')
    // 设置默认日期
    const { checkIn, checkOut } = getDefaultDates()
    setCheckInDate(checkIn)
    setCheckOutDate(checkOut)
  })

  useDidShow(() => {
    loadBanners()
    getLocation()
  })

  // 加载轮播图
  const loadBanners = async () => {
    try {
      const data = await getBanners()
      setBanners(data)
    } catch (error) {
      console.error('加载轮播图失败:', error)
    }
  }

  // 获取位置
  const getLocation = () => {
    Taro.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('定位成功:', res)
        // 这里可以通过逆地理编码获取城市名称
        // 简化处理，使用默认城市
      },
      fail: () => {
        console.log('定位失败，使用默认城市')
      }
    })
  }

  // 点击城市选择
  const handleCityClick = () => {
    // 可以跳转到城市选择页面或显示城市选择弹窗
    Taro.showActionSheet({
      itemList: ['上海', '北京', '广州', '深圳', '杭州', '成都', '南京', '武汉'],
      success: (res) => {
        const cities = ['上海', '北京', '广州', '深圳', '杭州', '成都', '南京', '武汉']
        setCity(cities[res.tapIndex])
      }
    })
  }

  // 点击轮播图
  const handleBannerClick = (banner: Banner) => {
    if (banner.targetHotelId?._id) {
      Taro.navigateTo({
        url: `/pages/hotel-detail/index?id=${banner.targetHotelId._id}`
      })
    }
  }

  // 切换标签选择
  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    )
  }

  // 日历确认
  const handleCalendarConfirm = (checkIn: string, checkOut: string) => {
    setCheckInDate(checkIn)
    setCheckOutDate(checkOut)
  }

  // 计算入住晚数
  const getNights = (): number => {
    if (!checkInDate || !checkOutDate) return 1
    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
  }

  // 点击查询按钮
  const handleSearch = () => {
    const priceOption = PRICE_OPTIONS.find((p) => p.value === priceRange)

    const params = new URLSearchParams()
    if (city) params.append('city', city)
    if (keyword) params.append('keyword', keyword)
    if (checkInDate) params.append('checkInDate', checkInDate)
    if (checkOutDate) params.append('checkOutDate', checkOutDate)
    if (starRating) params.append('starRating', starRating)
    if (priceOption?.min !== undefined) params.append('minPrice', String(priceOption.min))
    if (priceOption?.max !== undefined) params.append('maxPrice', String(priceOption.max))
    if (selectedTags.length > 0) params.append('tags', selectedTags.join(','))

    Taro.navigateTo({
      url: `/pages/hotel-list/index?${params.toString()}`
    })
  }

  const checkInDisplay = formatDateDisplay(checkInDate)
  const checkOutDisplay = formatDateDisplay(checkOutDate)
  const nights = getNights()

  return (
    <View className="index-page">
      {/* 顶部Banner轮播 */}
      <View className="banner-section">
        <Swiper
          className="banner-swiper"
          indicatorColor="rgba(255,255,255,0.4)"
          indicatorActiveColor="#fff"
          circular
          autoplay
          interval={4000}
          indicatorDots
        >
          {banners.map((banner) => (
            <SwiperItem key={banner._id} onClick={() => handleBannerClick(banner)}>
              <Image
                className="banner-image"
                src={banner.imageUrl}
                mode="aspectFill"
              />
              {banner.title && (
                <View className="banner-title">
                  <Text>{banner.title}</Text>
                </View>
              )}
            </SwiperItem>
          ))}
          {banners.length === 0 && (
            <SwiperItem>
              <View className="banner-placeholder">
                <Text>易宿酒店</Text>
                <Text className="sub">开启美好旅程</Text>
              </View>
            </SwiperItem>
          )}
        </Swiper>
      </View>

      {/* 核心查询区域 */}
      <View className="search-section">
        <View className="search-card">
          {/* 城市选择 */}
          <View className="search-row city-row" onClick={handleCityClick}>
            <View className="row-label">
              <Text className="icon">📍</Text>
              <Text>城市</Text>
            </View>
            <View className="row-value">
              <Text className="city-name">{city}</Text>
              <Text className="arrow">›</Text>
            </View>
          </View>

          {/* 关键词搜索 */}
          <View className="search-row keyword-row">
            <View className="row-label">
              <Text className="icon">🔍</Text>
              <Text>搜索</Text>
            </View>
            <Input
              className="keyword-input"
              placeholder="位置/品牌/酒店名"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value)}
            />
          </View>

          {/* 日期选择 */}
          <View className="search-row date-row" onClick={() => setShowCalendar(true)}>
            <View className="date-item">
              <Text className="date-label">入住</Text>
              <View className="date-value">
                <Text className="date-day">{checkInDisplay.month}{checkInDisplay.day}日</Text>
                <Text className="date-weekday">{checkInDisplay.weekday}</Text>
              </View>
            </View>
            <View className="date-nights">
              <Text className="nights-num">{nights}</Text>
              <Text className="nights-text">晚</Text>
            </View>
            <View className="date-item">
              <Text className="date-label">离店</Text>
              <View className="date-value">
                <Text className="date-day">{checkOutDisplay.month}{checkOutDisplay.day}日</Text>
                <Text className="date-weekday">{checkOutDisplay.weekday}</Text>
              </View>
            </View>
          </View>

          {/* 筛选条件 */}
          <View className="filter-row">
            <View
              className={`filter-item ${starRating ? 'active' : ''}`}
              onClick={() => setShowStarPicker(true)}
            >
              <Text>星级</Text>
              <Text className="filter-value">
                {STAR_OPTIONS.find((s) => s.value === starRating)?.label || '不限'}
              </Text>
            </View>
            <View
              className={`filter-item ${priceRange ? 'active' : ''}`}
              onClick={() => setShowPricePicker(true)}
            >
              <Text>价格</Text>
              <Text className="filter-value">
                {PRICE_OPTIONS.find((p) => p.value === priceRange)?.label || '不限'}
              </Text>
            </View>
          </View>
        </View>

        {/* 快捷标签 */}
        <View className="quick-tags">
          <View className="tags-title">
            <Text>快捷筛选</Text>
          </View>
          <View className="tags-list">
            {QUICK_TAGS.map((tag) => (
              <View
                key={tag.id}
                className={`tag-item ${selectedTags.includes(tag.name) ? 'active' : ''}`}
                onClick={() => toggleTag(tag.name)}
              >
                <Text className="tag-icon">{tag.icon}</Text>
                <Text className="tag-name">{tag.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 查询按钮 */}
        <View className="search-button" onClick={handleSearch}>
          <Text>查 询</Text>
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

      {/* 星级选择弹窗 */}
      {showStarPicker && (
        <View className="picker-overlay" onClick={() => setShowStarPicker(false)}>
          <View className="picker-content" onClick={(e) => e.stopPropagation()}>
            <View className="picker-header">
              <Text className="picker-title">选择星级</Text>
            </View>
            <View className="picker-options">
              {STAR_OPTIONS.map((option) => (
                <View
                  key={option.value}
                  className={`picker-option ${starRating === option.value ? 'active' : ''}`}
                  onClick={() => {
                    setStarRating(option.value)
                    setShowStarPicker(false)
                  }}
                >
                  <Text>{option.label}</Text>
                  {starRating === option.value && <Text className="check">✓</Text>}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 价格选择弹窗 */}
      {showPricePicker && (
        <View className="picker-overlay" onClick={() => setShowPricePicker(false)}>
          <View className="picker-content" onClick={(e) => e.stopPropagation()}>
            <View className="picker-header">
              <Text className="picker-title">选择价格区间</Text>
            </View>
            <View className="picker-options">
              {PRICE_OPTIONS.map((option) => (
                <View
                  key={option.value}
                  className={`picker-option ${priceRange === option.value ? 'active' : ''}`}
                  onClick={() => {
                    setPriceRange(option.value)
                    setShowPricePicker(false)
                  }}
                >
                  <Text>{option.label}</Text>
                  {priceRange === option.value && <Text className="check">✓</Text>}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
