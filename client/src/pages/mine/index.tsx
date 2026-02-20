import { View, Text, Image } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { getUserProfile, type UserProfile } from '../../services'
import './index.scss'

const BASE_URL = 'http://localhost:5000'

const MENU_ITEMS = [
  { icon: '📋', label: '我的订单', path: '/pages/order-list/index', needLogin: true },
  { icon: '❤️', label: '我的收藏', path: '/pages/favorites/index', needLogin: true },
  { icon: '📢', label: '系统公告', path: '/pages/announcements/index', needLogin: false },
  { icon: '👤', label: '个人资料', path: '/pages/profile/index', needLogin: true },
  { icon: '🔒', label: '修改密码', path: '/pages/change-password/index', needLogin: true },
]

export default function Mine() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useDidShow(() => {
    const token = Taro.getStorageSync('token')
    if (token) {
      setIsLoggedIn(true)
      loadUserProfile()
    } else {
      setIsLoggedIn(false)
      setUser(null)
    }
  })

  const loadUserProfile = async () => {
    try {
      const profile = await getUserProfile()
      setUser(profile)
      Taro.setStorageSync('user', JSON.stringify(profile))
    } catch {
      console.error('获取用户资料失败')
    }
  }

  const handleMenuClick = (item: typeof MENU_ITEMS[0]) => {
    if (item.needLogin && !isLoggedIn) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    Taro.navigateTo({ url: item.path })
  }

  const handleLogin = () => {
    Taro.navigateTo({ url: '/pages/login/index' })
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.removeStorageSync('token')
          Taro.removeStorageSync('user')
          setIsLoggedIn(false)
          setUser(null)
          Taro.showToast({ title: '已退出登录', icon: 'none' })
        }
      },
    })
  }

  const getAvatarUrl = () => {
    if (!user?.avatar) return ''
    if (user.avatar.startsWith('http')) return user.avatar
    return `${BASE_URL}${user.avatar}`
  }

  return (
    <View className="mine-page">
      {/* 头部用户信息 */}
      <View className="user-header">
        {isLoggedIn && user ? (
          <View className="user-info">
            {user.avatar ? (
              <Image className="user-avatar" src={getAvatarUrl()} mode="aspectFill" />
            ) : (
              <View className="avatar-placeholder">
                <Text>{user.username?.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View className="user-detail">
              <Text className="user-name">{user.username}</Text>
              <Text className="user-bio">{user.bio || '这个人很懒，什么都没写~'}</Text>
            </View>
          </View>
        ) : (
          <View className="login-prompt" onClick={handleLogin}>
            <View className="avatar-placeholder">
              <Text>👤</Text>
            </View>
            <Text className="login-text">点击登录/注册</Text>
          </View>
        )}
      </View>

      {/* 快捷入口 */}
      {isLoggedIn && (
        <View className="quick-entry">
          <View className="entry-item" onClick={() => Taro.switchTab({ url: '/pages/order-list/index' })}>
            <Text className="entry-icon">📋</Text>
            <Text className="entry-label">全部订单</Text>
          </View>
          <View className="entry-item" onClick={() => Taro.switchTab({ url: '/pages/favorites/index' })}>
            <Text className="entry-icon">❤️</Text>
            <Text className="entry-label">我的收藏</Text>
          </View>
          <View className="entry-item" onClick={() => Taro.navigateTo({ url: '/pages/announcements/index' })}>
            <Text className="entry-icon">📢</Text>
            <Text className="entry-label">系统公告</Text>
          </View>
          <View className="entry-item" onClick={() => Taro.navigateTo({ url: '/pages/profile/index' })}>
            <Text className="entry-icon">⚙️</Text>
            <Text className="entry-label">设置</Text>
          </View>
        </View>
      )}

      {/* 功能菜单 */}
      <View className="menu-section">
        {MENU_ITEMS.map((item) => (
          <View key={item.label} className="menu-item" onClick={() => handleMenuClick(item)}>
            <Text className="menu-icon">{item.icon}</Text>
            <Text className="menu-label">{item.label}</Text>
            <Text className="menu-arrow">›</Text>
          </View>
        ))}
      </View>

      {/* 退出登录 */}
      {isLoggedIn && (
        <View className="logout-section">
          <View className="logout-btn" onClick={handleLogout}>
            <Text>退出登录</Text>
          </View>
        </View>
      )}
    </View>
  )
}


