import { View, Text, Image, ScrollView, Input } from '@tarojs/components'
import { useLoad, useRouter, useReachBottom } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { searchHotels, Hotel, HotelSearchParams } from '../../services'
import Calendar from '../../components/Calendar'
import './index.scss'

// 排序选项
const SORT_OPTIONS = [
  { value: '', label: '默认排序' },
  { value: 'price_asc', label: '价格从低到高' },
  { value: 'price_desc', label: '价格从高到低' },
  { value: 'score_desc', label: '评分最高' },
  { value: 'distance', label: '距离最近' }
]

// 星级筛选
const STAR_FILTERS = [
  { value: '', label: '全部' },
  { value: '5', label: '五星' },
  { value: '4', label: '四星' },
  { value: '3', label: '三星' },
  { value: '2', label: '经济型' }
]

// 价格筛选
const PRICE_FILTERS = [
  { value: '', label: '不限', min: undefined, max: undefined },
  { value: '0-200', label: '¥200以下', min: 0, max: 200 },
  { value: '200-400', label: '¥200-400', min: 200, max: 400 },
  { value: '400-700', label: '¥400-700', min: 400, max: 700 },
  { value: '700+', label: '¥700+', min: 700, max: undefined }
]

// 格式化日期
function formatShortDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}.${date.getDate()}`
}

// 渲染星级
function renderStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

export default function HotelList() {
  const router = useRouter()
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // 搜索参数
  const [city, setCity] = useState('')
  const [keyword, setKeyword] = useState('')
  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')
  const [starRating, setStarRating] = useState('')
  const [minPrice, setMinPrice] = useState<number | undefined>()
  const [maxPrice, setMaxPrice] = useState<number | undefined>()
  const [priceRange, setPriceRange] = useState('')
  const [tags, setTags] = useState('')
  const [sortType, setSortType] = useState<HotelSearchParams['sortType']>('')

  // UI 状态
  const [showCalendar, setShowCalendar] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'sort' | 'star' | 'price' | null>(null)

  useLoad(() => {
    // 从路由参数初始化搜索条件
    const params = router.params
    if (params.city) setCity(params.city)
    if (params.keyword) setKeyword(params.keyword)
    if (params.checkInDate) setCheckInDate(params.checkInDate)
    if (params.checkOutDate) setCheckOutDate(params.checkOutDate)
    if (params.starRating) setStarRating(params.starRating)
    if (params.minPrice) setMinPrice(Number(params.minPrice))
    if (params.maxPrice) setMaxPrice(Number(params.maxPrice))
    if (params.tags) setTags(params.tags)
  })

  // 加载酒店数据
  const loadHotels = useCallback(async (isRefresh = false) => {
    if (loading) return
    if (!isRefresh && !hasMore) return

    setLoading(true)
    try {
      const currentPage = isRefresh ? 1 : page
      const params: HotelSearchParams = {
        city,
        keyword,
        checkInDate,
        checkOutDate,
        starRating: starRating ? Number(starRating) : undefined,
        minPrice,
        maxPrice,
        tags,
        sortType: sortType || undefined,
        page: currentPage,
        limit: 10
      }

      const result = await searchHotels(params)

      if (isRefresh) {
        setHotels(result.data)
        setPage(2)
      } else {
        setHotels((prev) => [...prev, ...result.data])
        setPage((prev) => prev + 1)
      }

      setTotal(result.pagination.total)
      setHasMore(currentPage < result.pagination.totalPages)
    } catch (error) {
      console.error('加载酒店失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [city, keyword, checkInDate, checkOutDate, starRating, minPrice, maxPrice, tags, sortType, page, loading, hasMore])

  // 初始加载
  useEffect(() => {
    loadHotels(true)
  }, [city, keyword, checkInDate, checkOutDate, starRating, minPrice, maxPrice, tags, sortType])

  // 触底加载更多
  useReachBottom(() => {
    loadHotels()
  })

  // 计算入住晚数
  const getNights = (): number => {
    if (!checkInDate || !checkOutDate) return 1
    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
  }

  // 城市选择
  const handleCityClick = () => {
    Taro.showActionSheet({
      itemList: ['上海', '北京', '广州', '深圳', '杭州', '成都', '南京', '武汉'],
      success: (res) => {
        const cities = ['上海', '北京', '广州', '深圳', '杭州', '成都', '南京', '武汉']
        setCity(cities[res.tapIndex])
      }
    })
  }

  // 日历确认
  const handleCalendarConfirm = (checkIn: string, checkOut: string) => {
    setCheckInDate(checkIn)
    setCheckOutDate(checkOut)
  }

  // 点击酒店
  const handleHotelClick = (hotel: Hotel) => {
    Taro.navigateTo({
      url: `/pages/hotel-detail/index?id=${hotel._id}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}`
    })
  }

  // 选择价格范围
  const handlePriceSelect = (option: typeof PRICE_FILTERS[0]) => {
    setPriceRange(option.value)
    setMinPrice(option.min)
    setMaxPrice(option.max)
    setActiveFilter(null)
  }

  // 选择排序
  const handleSortSelect = (value: HotelSearchParams['sortType']) => {
    setSortType(value)
    setActiveFilter(null)
  }

  // 选择星级
  const handleStarSelect = (value: string) => {
    setStarRating(value)
    setActiveFilter(null)
  }

  const nights = getNights()

  return (
    <View className="hotel-list-page">
      {/* 顶部搜索条 */}
      <View className="search-header">
        <View className="header-top">
          <View className="city-selector" onClick={handleCityClick}>
            <Text className="city-name">{city || '选择城市'}</Text>
            <Text className="arrow">▼</Text>
          </View>
          <View className="search-input-wrap">
            <Text className="search-icon">🔍</Text>
            <Input
              className="search-input"
              placeholder="搜索酒店/位置"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value)}
              onConfirm={() => loadHotels(true)}
            />
          </View>
        </View>

        <View className="date-bar" onClick={() => setShowCalendar(true)}>
          <View className="date-info">
            <Text className="date-text">{formatShortDate(checkInDate)} 入住</Text>
            <Text className="date-divider">—</Text>
            <Text className="date-text">{formatShortDate(checkOutDate)} 离店</Text>
            <Text className="nights-badge">共{nights}晚</Text>
          </View>
        </View>
      </View>

      {/* 筛选条 */}
      <View className="filter-bar">
        <View
          className={`filter-tab ${activeFilter === 'sort' ? 'active' : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'sort' ? null : 'sort')}
        >
          <Text>{SORT_OPTIONS.find((s) => s.value === sortType)?.label || '排序'}</Text>
          <Text className="filter-arrow">▼</Text>
        </View>
        <View
          className={`filter-tab ${activeFilter === 'star' ? 'active' : ''} ${starRating ? 'selected' : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'star' ? null : 'star')}
        >
          <Text>{starRating ? `${starRating}星` : '星级'}</Text>
          <Text className="filter-arrow">▼</Text>
        </View>
        <View
          className={`filter-tab ${activeFilter === 'price' ? 'active' : ''} ${priceRange ? 'selected' : ''}`}
          onClick={() => setActiveFilter(activeFilter === 'price' ? null : 'price')}
        >
          <Text>{PRICE_FILTERS.find((p) => p.value === priceRange)?.label || '价格'}</Text>
          <Text className="filter-arrow">▼</Text>
        </View>
        <View
          className="filter-tab filter-more"
          onClick={() => setShowFilterPanel(true)}
        >
          <Text>筛选</Text>
          <Text className="filter-icon">☰</Text>
        </View>
      </View>

      {/* 筛选下拉面板 */}
      {activeFilter && (
        <View className="filter-dropdown-overlay" onClick={() => setActiveFilter(null)}>
          <View className="filter-dropdown" onClick={(e) => e.stopPropagation()}>
            {activeFilter === 'sort' && (
              <View className="dropdown-options">
                {SORT_OPTIONS.map((option) => (
                  <View
                    key={option.value}
                    className={`dropdown-option ${sortType === option.value ? 'active' : ''}`}
                    onClick={() => handleSortSelect(option.value as HotelSearchParams['sortType'])}
                  >
                    <Text>{option.label}</Text>
                    {sortType === option.value && <Text className="check">✓</Text>}
                  </View>
                ))}
              </View>
            )}
            {activeFilter === 'star' && (
              <View className="dropdown-options">
                {STAR_FILTERS.map((option) => (
                  <View
                    key={option.value}
                    className={`dropdown-option ${starRating === option.value ? 'active' : ''}`}
                    onClick={() => handleStarSelect(option.value)}
                  >
                    <Text>{option.label}</Text>
                    {starRating === option.value && <Text className="check">✓</Text>}
                  </View>
                ))}
              </View>
            )}
            {activeFilter === 'price' && (
              <View className="dropdown-options">
                {PRICE_FILTERS.map((option) => (
                  <View
                    key={option.value}
                    className={`dropdown-option ${priceRange === option.value ? 'active' : ''}`}
                    onClick={() => handlePriceSelect(option)}
                  >
                    <Text>{option.label}</Text>
                    {priceRange === option.value && <Text className="check">✓</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* 酒店列表 */}
      <ScrollView
        className="hotel-list"
        scrollY
        enhanced
        showScrollbar={false}
        onScrollToLower={() => loadHotels()}
      >
        <View className="list-info">
          <Text>共找到 {total} 家酒店</Text>
        </View>

        {hotels.map((hotel) => (
          <View
            key={hotel._id}
            className="hotel-card"
            onClick={() => handleHotelClick(hotel)}
          >
            <Image
              className="hotel-image"
              src={hotel.images?.[0] || '/assets/default-hotel.png'}
              mode="aspectFill"
            />
            <View className="hotel-info">
              <View className="hotel-name-row">
                <Text className="hotel-name">{hotel.name}</Text>
                <View className="hotel-star">
                  <Text className="star-text">{renderStars(hotel.starRating)}</Text>
                </View>
              </View>

              <View className="hotel-score-row">
                <View className="score-badge">
                  <Text className="score-num">{hotel.score?.toFixed(1) || '5.0'}</Text>
                </View>
                <Text className="score-label">
                  {hotel.score >= 4.5 ? '超棒' : hotel.score >= 4 ? '很好' : '不错'}
                </Text>
              </View>

              <View className="hotel-location">
                <Text className="location-icon">📍</Text>
                <Text className="location-text" numberOfLines={1}>
                  {hotel.address}
                </Text>
              </View>

              {hotel.tags && hotel.tags.length > 0 && (
                <View className="hotel-tags">
                  {hotel.tags.slice(0, 3).map((tag, index) => (
                    <Text key={index} className="tag-item">{tag}</Text>
                  ))}
                </View>
              )}

              <View className="hotel-price-row">
                <View className="price-info">
                  <Text className="price-label">¥</Text>
                  <Text className="price-num">{hotel.price}</Text>
                  <Text className="price-unit">起</Text>
                </View>
              </View>
            </View>
          </View>
        ))}

        {/* 加载状态 */}
        {loading && (
          <View className="loading-more">
            <Text>加载中...</Text>
          </View>
        )}

        {!loading && !hasMore && hotels.length > 0 && (
          <View className="no-more">
            <Text>— 没有更多了 —</Text>
          </View>
        )}

        {!loading && hotels.length === 0 && (
          <View className="empty-list">
            <Text className="empty-icon">🏨</Text>
            <Text className="empty-text">暂无符合条件的酒店</Text>
            <Text className="empty-hint">试试调整搜索条件</Text>
          </View>
        )}
      </ScrollView>

      {/* 日历弹窗 */}
      <Calendar
        visible={showCalendar}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        onClose={() => setShowCalendar(false)}
        onConfirm={handleCalendarConfirm}
      />

      {/* 更多筛选面板 */}
      {showFilterPanel && (
        <View className="filter-panel-overlay" onClick={() => setShowFilterPanel(false)}>
          <View className="filter-panel" onClick={(e) => e.stopPropagation()}>
            <View className="panel-header">
              <Text className="panel-title">更多筛选</Text>
              <View className="panel-close" onClick={() => setShowFilterPanel(false)}>×</View>
            </View>

            <ScrollView className="panel-content" scrollY>
              <View className="filter-section">
                <Text className="section-title">酒店星级</Text>
                <View className="section-options">
                  {STAR_FILTERS.map((option) => (
                    <View
                      key={option.value}
                      className={`option-item ${starRating === option.value ? 'active' : ''}`}
                      onClick={() => setStarRating(option.value)}
                    >
                      <Text>{option.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="filter-section">
                <Text className="section-title">价格区间</Text>
                <View className="section-options">
                  {PRICE_FILTERS.map((option) => (
                    <View
                      key={option.value}
                      className={`option-item ${priceRange === option.value ? 'active' : ''}`}
                      onClick={() => handlePriceSelect(option)}
                    >
                      <Text>{option.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View className="panel-footer">
              <View
                className="reset-btn"
                onClick={() => {
                  setStarRating('')
                  setPriceRange('')
                  setMinPrice(undefined)
                  setMaxPrice(undefined)
                }}
              >
                <Text>重置</Text>
              </View>
              <View
                className="confirm-btn"
                onClick={() => {
                  setShowFilterPanel(false)
                  loadHotels(true)
                }}
              >
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

