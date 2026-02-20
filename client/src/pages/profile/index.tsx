import { View, Text, Image, Input, Picker } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { getUserProfile, updateUserProfile, uploadAvatar, type UserProfile } from '../../services'
import './index.scss'

const BASE_URL = 'http://localhost:5000'

const GENDER_OPTIONS = ['保密', '男', '女']
const GENDER_VALUES: Record<string, string> = {
  '保密': 'unknown',
  '男': 'male',
  '女': 'female',
}
const GENDER_LABELS: Record<string, string> = {
  unknown: '保密',
  male: '男',
  female: '女',
}

export default function Profile() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState('unknown')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useLoad(() => {
    loadProfile()
  })

  const loadProfile = async () => {
    setLoading(true)
    try {
      const data = await getUserProfile()
      setUser(data)
      setBio(data.bio || '')
      setGender(data.gender || 'unknown')
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateUserProfile({ bio, gender })
      setUser(updated)
      Taro.setStorageSync('user', JSON.stringify(updated))
      Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const handleChooseAvatar = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempPath = res.tempFilePaths[0]
        try {
          Taro.showLoading({ title: '上传中...' })
          const result = await uploadAvatar(tempPath)
          if (result.avatar) {
            setUser(prev => prev ? { ...prev, avatar: result.avatar } : prev)
            const cached = Taro.getStorageSync('user')
            if (cached) {
              const u = JSON.parse(cached)
              u.avatar = result.avatar
              Taro.setStorageSync('user', JSON.stringify(u))
            }
          }
          Taro.hideLoading()
          Taro.showToast({ title: '头像已更新', icon: 'success' })
        } catch {
          Taro.hideLoading()
          Taro.showToast({ title: '上传失败', icon: 'none' })
        }
      },
    })
  }

  const getAvatarUrl = () => {
    if (!user?.avatar) return ''
    if (user.avatar.startsWith('http')) return user.avatar
    return `${BASE_URL}${user.avatar}`
  }

  if (loading) {
    return <View className="loading-page"><Text>加载中...</Text></View>
  }

  return (
    <View className="profile-page">
      {/* 头像 */}
      <View className="avatar-section" onClick={handleChooseAvatar}>
        {user?.avatar ? (
          <Image className="avatar-img" src={getAvatarUrl()} mode="aspectFill" />
        ) : (
          <View className="avatar-placeholder">
            <Text>{user?.username?.charAt(0).toUpperCase() || '?'}</Text>
          </View>
        )}
        <Text className="avatar-hint">点击更换头像</Text>
      </View>

      {/* 基本信息 */}
      <View className="form-section">
        <View className="form-item">
          <Text className="form-label">用户名</Text>
          <Text className="form-value readonly">{user?.username}</Text>
        </View>

        <View className="form-item">
          <Text className="form-label">角色</Text>
          <Text className="form-value readonly">
            {user?.role === 'admin' ? '管理员' : user?.role === 'merchant' ? '商户' : '普通用户'}
          </Text>
        </View>

        <Picker
          mode="selector"
          range={GENDER_OPTIONS}
          value={GENDER_OPTIONS.indexOf(GENDER_LABELS[gender] || '保密')}
          onChange={(e) => {
            const label = GENDER_OPTIONS[Number(e.detail.value)]
            setGender(GENDER_VALUES[label] || 'unknown')
          }}
        >
          <View className="form-item">
            <Text className="form-label">性别</Text>
            <Text className="form-value">{GENDER_LABELS[gender] || '保密'} ▾</Text>
          </View>
        </Picker>

        <View className="form-item bio-item">
          <Text className="form-label">个人简介</Text>
          <Input
            className="form-input"
            placeholder="介绍一下自己吧"
            value={bio}
            onInput={(e) => setBio(e.detail.value)}
            maxlength={100}
          />
        </View>
      </View>

      {/* 保存按钮 */}
      <View
        className={`save-btn ${saving ? 'disabled' : ''}`}
        onClick={!saving ? handleSave : undefined}
      >
        <Text>{saving ? '保存中...' : '保存修改'}</Text>
      </View>
    </View>
  )
}


