import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { login } from '../../services'
import './index.scss'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!username.trim()) {
      Taro.showToast({ title: '请输入账号', icon: 'none' })
      return
    }
    if (!password) {
      Taro.showToast({ title: '请输入密码', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const res = await login({ username: username.trim(), password })
      Taro.setStorageSync('token', res.token)
      Taro.setStorageSync('user', JSON.stringify(res.user))
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      }, 1500)
    } catch (error) {
      console.error('登录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const goRegister = () => {
    Taro.navigateTo({ url: '/pages/register/index' })
  }

  return (
    <View className="login-page">
      <View className="login-header">
        <Text className="app-name">易宿酒店</Text>
        <Text className="app-slogan">开启美好旅程</Text>
      </View>

      <View className="login-form">
        <View className="form-item">
          <Text className="form-icon">👤</Text>
          <Input
            className="form-input"
            placeholder="请输入账号"
            value={username}
            onInput={(e) => setUsername(e.detail.value)}
          />
        </View>
        <View className="form-item">
          <Text className="form-icon">🔒</Text>
          <Input
            className="form-input"
            placeholder="请输入密码"
            password
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>

        <View
          className={`login-btn ${loading ? 'disabled' : ''}`}
          onClick={!loading ? handleLogin : undefined}
        >
          <Text>{loading ? '登录中...' : '登录'}</Text>
        </View>

        <View className="login-footer">
          <Text className="footer-text">还没有账号？</Text>
          <Text className="footer-link" onClick={goRegister}>立即注册</Text>
        </View>
      </View>
    </View>
  )
}


