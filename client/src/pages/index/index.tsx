import { View, Text, Image, Swiper, SwiperItem, Input, ScrollView } from '@tarojs/components'
import { useLoad, useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { getBanners, Banner } from '../../services'
import Calendar from '../../components/Calendar'
import './index.scss'

// 顶部Tab配置
const TABS = [
  { key: 'domestic', label: '国内' },
  { key: 'overseas', label: '海外' },
  { key: 'hourly', label: '钟点房' },
  { key: 'homestay', label: '民宿' },
]

// 快捷标签配置
const QUICK_TAGS = [
  { id: '1', name: '免费停车场' },
  { id: '2', name: '上海浦东国际机场' },
  { id: '3', name: '上海虹桥国际机场' },
]

// 城市配置
const CITY_OPTIONS = {
  hot: [
    { name: '上海', pinyin: 'shanghai' },
    { name: '北京', pinyin: 'beijing' },
    { name: '广州', pinyin: 'guangzhou' },
    { name: '深圳', pinyin: 'shenzhen' },
    { name: '杭州', pinyin: 'hangzhou' },
    { name: '成都', pinyin: 'chengdu' },
    { name: '南京', pinyin: 'nanjing' },
    { name: '武汉', pinyin: 'wuhan' },
  ],
  groups: [
    {
      letter: 'A',
      cities: ['安庆', '安阳', '鞍山']
    },
    {
      letter: 'B',
      cities: ['北京', '保定', '包头', '蚌埠', '滨州']
    },
    {
      letter: 'C',
      cities: ['成都', '重庆', '长沙', '长春', '常州', '常德']
    },
    {
      letter: 'D',
      cities: ['大连', '东莞', '大同', '德州']
    },
    {
      letter: 'F',
      cities: ['福州', '佛山', '阜阳']
    },
    {
      letter: 'G',
      cities: ['广州', '贵阳', '桂林', '赣州']
    },
    {
      letter: 'H',
      cities: ['杭州', '合肥', '哈尔滨', '海口', '惠州', '呼和浩特', '湖州']
    },
    {
      letter: 'J',
      cities: ['济南', '嘉兴', '金华', '江门', '吉林', '九江']
    },
    {
      letter: 'K',
      cities: ['昆明', '开封']
    },
    {
      letter: 'L',
      cities: ['兰州', '洛阳', '柳州', '临沂', '连云港', '廊坊']
    },
    {
      letter: 'M',
      cities: ['绵阳', '茂名']
    },
    {
      letter: 'N',
      cities: ['南京', '宁波', '南昌', '南宁', '南通', '南阳']
    },
    {
      letter: 'Q',
      cities: ['青岛', '泉州', '秦皇岛', '清远']
    },
    {
      letter: 'S',
      cities: ['上海', '深圳', '苏州', '沈阳', '石家庄', '绍兴', '汕头', '三亚']
    },
    {
      letter: 'T',
      cities: ['天津', '太原', '台州', '唐山', '泰州']
    },
    {
      letter: 'W',
      cities: ['武汉', '无锡', '温州', '威海', '芜湖', '潍坊', '乌鲁木齐']
    },
    {
      letter: 'X',
      cities: ['西安', '厦门', '徐州', '西宁', '襄阳', '新乡']
    },
    {
      letter: 'Y',
      cities: ['烟台', '扬州', '宜昌', '银川', '盐城', '岳阳', '义乌']
    },
    {
      letter: 'Z',
      cities: ['郑州', '珠海', '中山', '镇江', '漳州', '湛江', '株洲', '遵义']
    }
  ]
}

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

// 格式化日期为 "MM月DD日" 格式
function formatDateStr(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`
}

// 获取相对日期标签（今天/明天/后天/周x）
function getRelativeDayLabel(dateStr: string): string {
  if (!dateStr) return ''
  const today = new Date()
  const date = new Date(dateStr)
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekdays[date.getDay()]
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

// 判断当前是否在凌晨0-6点之间
function isEarlyMorning(): boolean {
  const hour = new Date().getHours()
  return hour >= 0 && hour < 6
}

export default function Index() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [activeTab, setActiveTab] = useState('domestic')
  const [city, setCity] = useState('上海')
  const [keyword, setKeyword] = useState('')
  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [starRating, setStarRating] = useState('')
  const [priceRange, setPriceRange] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [showFilterPicker, setShowFilterPicker] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [cityKeyword, setCityKeyword] = useState('')

  useLoad(() => {
    console.log('首页加载')
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
      },
      fail: () => {
        console.log('定位失败，使用默认城市')
      }
    })
  }

  // 点击城市选择
  const handleCityClick = () => {
    setCityKeyword('')
    setShowCityPicker(true)
  }

  // 选择城市
  const handleCitySelect = (cityName: string) => {
    setCity(cityName)
    setShowCityPicker(false)
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

  const nights = getNights()
  const normalizedCityKeyword = cityKeyword.trim().toLowerCase()
  const filteredHotCities = CITY_OPTIONS.hot.filter((item) => {
    if (!normalizedCityKeyword) return true
    return item.name.includes(normalizedCityKeyword) || item.pinyin.includes(normalizedCityKeyword)
  })
  const filteredCityGroups = CITY_OPTIONS.groups
    .map((group) => ({
      letter: group.letter,
      cities: group.cities.filter((cityName) => {
        if (!normalizedCityKeyword) return true
        return cityName.includes(normalizedCityKeyword)
      })
    }))
    .filter((group) => group.cities.length > 0)
  const hasCitySearchResult = filteredHotCities.length > 0 || filteredCityGroups.length > 0

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
          {/* Tab选项栏: 国内/海外/钟点房/民宿 */}
          <View className="tab-bar">
            {TABS.map((tab) => (
              <View
                key={tab.key}
                className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Text className="tab-label">{tab.label}</Text>
                {tab.key === 'domestic' && <Text className="tab-hot">🔥</Text>}
              </View>
            ))}
          </View>

          {/* 城市 + 搜索 + 定位 同一行 */}
          <View className="city-search-row">
            <View className="city-selector" onClick={handleCityClick}>
              <Text className="city-name">{city}</Text>
              <Text className="city-arrow">▾</Text>
            </View>
            <View className="row-divider"></View>
            <View className="search-input-wrap">
              <Input
                className="keyword-input"
                placeholder="位置/品牌/酒店"
                value={keyword}
                onInput={(e) => setKeyword(e.detail.value)}
              />
            </View>
            <View className="location-btn" onClick={getLocation}>
              <Text className="location-icon">◎</Text>
            </View>
          </View>

          {/* 日期选择行 */}
          <View className="date-row" onClick={() => setShowCalendar(true)}>
            <View className="date-item">
              <Text className="date-bold">{formatDateStr(checkInDate)}</Text>
              <Text className="date-label">{getRelativeDayLabel(checkInDate)}</Text>
            </View>
            <Text className="date-separator">—</Text>
            <View className="date-item">
              <Text className="date-bold">{formatDateStr(checkOutDate)}</Text>
              <Text className="date-label">{getRelativeDayLabel(checkOutDate)}</Text>
            </View>
            <View className="nights-badge">
              <Text className="nights-text">共{nights}晚</Text>
            </View>
          </View>

          {/* 凌晨入住提示 */}
          {isEarlyMorning() && (
            <View className="early-notice">
              <View className="notice-dot"></View>
              <Text className="notice-text">当前已过0点，如需今天凌晨6点前入住，请选择"今天凌晨"</Text>
            </View>
          )}

          {/* 价格/星级 */}
          <View className="price-star-row" onClick={() => setShowFilterPicker(true)}>
            <Text className="price-star-text">价格/星级</Text>
            {(starRating || priceRange) && (
              <Text className="price-star-value">
                {[
                  STAR_OPTIONS.find((s) => s.value === starRating)?.label,
                  PRICE_OPTIONS.find((p) => p.value === priceRange)?.label
                ].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>

          {/* 快捷标签 */}
          <View className="quick-tags-row">
            {QUICK_TAGS.map((tag) => (
              <View
                key={tag.id}
                className={`quick-tag ${selectedTags.includes(tag.name) ? 'active' : ''}`}
                onClick={() => toggleTag(tag.name)}
              >
                <Text>{tag.name}</Text>
              </View>
            ))}
          </View>

          {/* 查询按钮 */}
          <View className="search-btn-wrap">
            <View className="search-button" onClick={handleSearch}>
              <Text>查询</Text>
            </View>
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

      {/* 价格/星级筛选弹窗 */}
      {showFilterPicker && (
        <View className="picker-overlay" onClick={() => setShowFilterPicker(false)}>
          <View className="picker-content" onClick={(e) => e.stopPropagation()}>
            <View className="picker-header">
              <Text className="picker-title">价格/星级</Text>
            </View>

            {/* 星级选择 */}
            <View className="filter-section">
              <Text className="filter-section-title">星级</Text>
              <View className="filter-options">
                {STAR_OPTIONS.map((option) => (
                  <View
                    key={option.value}
                    className={`filter-option-item ${starRating === option.value ? 'active' : ''}`}
                    onClick={() => setStarRating(option.value)}
                  >
                    <Text>{option.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 价格选择 */}
            <View className="filter-section">
              <Text className="filter-section-title">价格区间</Text>
              <View className="filter-options">
                {PRICE_OPTIONS.map((option) => (
                  <View
                    key={option.value}
                    className={`filter-option-item ${priceRange === option.value ? 'active' : ''}`}
                    onClick={() => setPriceRange(option.value)}
                  >
                    <Text>{option.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 确认按钮 */}
            <View className="filter-confirm-btn" onClick={() => setShowFilterPicker(false)}>
              <Text>确定</Text>
            </View>
          </View>
        </View>
      )}

      {/* 城市选择弹窗 */}
      {showCityPicker && (
        <View className="picker-overlay" onClick={() => setShowCityPicker(false)}>
          <View className="city-picker-content" onClick={(e) => e.stopPropagation()}>
            <View className="city-picker-header">
              <Text className="city-picker-title">选择城市</Text>
              <View className="city-picker-close" onClick={() => setShowCityPicker(false)}>
                <Text>✕</Text>
              </View>
            </View>

            <View className="city-search-box">
              <Input
                className="city-search-input"
                placeholder="搜索城市（中文/拼音）"
                value={cityKeyword}
                onInput={(e) => setCityKeyword(e.detail.value)}
              />
            </View>

            <ScrollView className="city-picker-scroll" scrollY>
              {/* 当前定位城市 */}
              <View className="city-section">
                <Text className="city-section-title">当前选择</Text>
                <View className="city-location-row">
                  <View className="city-location-item" onClick={() => handleCitySelect(city)}>
                    <Text className="location-icon-small">◎</Text>
                    <Text>{city}</Text>
                  </View>
                </View>
              </View>

              {/* 热门城市 */}
              <View className="city-section">
                <Text className="city-section-title">热门城市</Text>
                <View className="city-grid">
                  {filteredHotCities.map((item) => (
                    <View
                      key={item.name}
                      className={`city-grid-item ${city === item.name ? 'active' : ''}`}
                      onClick={() => handleCitySelect(item.name)}
                    >
                      <Text>{item.name}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* 字母索引城市列表 */}
              <View className="city-list-section">
                <Text className="city-section-title">全部城市</Text>
                <View className="city-groups">
                  {filteredCityGroups.map((group) => (
                    <View key={group.letter} className="city-group">
                      <Text className="city-group-letter">{group.letter}</Text>
                      <View className="city-group-items">
                        {group.cities.map((cityName) => (
                          <View
                            key={cityName}
                            className={`city-group-item ${city === cityName ? 'active' : ''}`}
                            onClick={() => handleCitySelect(cityName)}
                          >
                            <Text>{cityName}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {!hasCitySearchResult && (
                <View className="city-empty">
                  <Text>未找到匹配城市</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  )
}
