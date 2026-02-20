import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { changePassword } from '../../services'
import './index.scss'

export default function ChangePassword() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!oldPassword) {
      Taro.showToast({ title: '请输入原密码', icon: 'none' })
      return
    }
    if (!newPassword || newPassword.length < 6) {
      Taro.showToast({ title: '新密码至少6位', icon: 'none' })
      return
    }
    if (newPassword !== confirmPassword) {
      Taro.showToast({ title: '两次密码不一致', icon: 'none' })
      return
    }
    if (oldPassword === newPassword) {
      Taro.showToast({ title: '新密码不能与原密码相同', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      await changePassword({ oldPassword, newPassword })
      Taro.showToast({ title: '密码修改成功', icon: 'success' })
      setTimeout(() => {
        // 修改密码后退出登录
        Taro.removeStorageSync('token')
        Taro.removeStorageSync('user')
        Taro.redirectTo({ url: '/pages/login/index' })
      }, 1500)
    } catch (error) {
      console.error('修改密码失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="change-password-page">
      <View className="form-section">
        <View className="form-item">
          <Text className="form-label">原密码</Text>
          <Input
            className="form-input"
            placeholder="请输入原密码"
            password
            value={oldPassword}
            onInput={(e) => setOldPassword(e.detail.value)}
          />
        </View>

        <View className="form-item">
          <Text className="form-label">新密码</Text>
          <Input
            className="form-input"
            placeholder="请输入新密码（至少6位）"
            password
            value={newPassword}
            onInput={(e) => setNewPassword(e.detail.value)}
          />
        </View>

        <View className="form-item">
          <Text className="form-label">确认新密码</Text>
          <Input
            className="form-input"
            placeholder="请再次输入新密码"
            password
            value={confirmPassword}
            onInput={(e) => setConfirmPassword(e.detail.value)}
          />
        </View>
      </View>

      <View className="tips-section">
        <Text className="tips-title">温馨提示：</Text>
        <Text className="tips-text">• 密码长度不少于6位</Text>
        <Text className="tips-text">• 修改密码后需要重新登录</Text>
        <Text className="tips-text">• 请牢记新密码</Text>
      </View>

      <View
        className={`submit-btn ${loading ? 'disabled' : ''}`}
        onClick={!loading ? handleSubmit : undefined}
      >
        <Text>{loading ? '提交中...' : '确认修改'}</Text>
      </View>
    </View>
  )
}


