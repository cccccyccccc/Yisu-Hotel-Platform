import { View, Text, Image } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { getMyFavorites, removeFavorite, type Hotel } from '../../services'
import './index.scss'

const BASE_URL = 'http://localhost:5000'

function getImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

export default function Favorites() {
  const [favorites, setFavorites] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => Taro.redirectTo({ url: '/pages/login/index' }), 1500)
      return
    }
    loadFavorites()
  })

  const loadFavorites = async () => {
    setLoading(true)
    try {
      const data = await getMyFavorites()
      setFavorites(data)
    } catch {
      console.error('获取收藏列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = (hotelId: string) => {
    Taro.showModal({
      title: '提示',
      content: '确定取消收藏？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await removeFavorite(hotelId)
            Taro.showToast({ title: '已取消收藏', icon: 'success' })
            loadFavorites()
          } catch {
            Taro.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      },
    })
  }

  const goDetail = (hotelId: string) => {
    Taro.navigateTo({ url: `/pages/hotel-detail/index?id=${hotelId}` })
  }

  return (
    <View className="favorites-page">
      {loading ? (
        <View className="empty-state"><Text>加载中...</Text></View>
      ) : favorites.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-icon">💔</Text>
          <Text className="empty-text">暂无收藏</Text>
          <Text className="empty-hint">去首页看看有没有喜欢的酒店吧～</Text>
        </View>
      ) : (
        <View className="fav-list">
          {favorites.map(hotel => (
            <View key={hotel._id} className="fav-card" onClick={() => goDetail(hotel._id)}>
              <Image
                className="fav-img"
                src={getImageUrl(hotel.images?.[0] || '')}
                mode="aspectFill"
              />
              <View className="fav-info">
                <Text className="fav-name">{hotel.name}</Text>
                <Text className="fav-address">📍 {hotel.address}</Text>
                <View className="fav-bottom">
                  <View className="fav-rating">
                    <Text className="rating-star">⭐</Text>
                    <Text className="rating-num">{hotel.rating?.toFixed(1) || '暂无'}</Text>
                  </View>
                  <Text className="fav-price">
                    ¥{hotel.minPrice || '--'}<Text className="price-unit">起</Text>
                  </Text>
                </View>
              </View>
              <View
                className="fav-remove"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(hotel._id)
                }}
              >
                <Text>♥</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}


