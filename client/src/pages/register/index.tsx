import { View, Text, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { register, generateCaptcha, verifyCaptcha } from '../../services'
import './index.scss'

const ROLE_OPTIONS = ['普通用户', '酒店商户']
const ROLE_VALUES: Record<string, 'user' | 'merchant'> = {
  '普通用户': 'user',
  '酒店商户': 'merchant',
}

export default function Register() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [roleLabel, setRoleLabel] = useState('普通用户')
  const [role, setRole] = useState<'user' | 'merchant'>('user')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaVerified, setCaptchaVerified] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleVerifyCaptcha = async () => {
    try {
      Taro.showLoading({ title: '加载验证码...' })
      const captchaData = await generateCaptcha()
      Taro.hideLoading()

      // 简化版：小程序中直接以弹窗形式提示用户拖动验证
      // 实际生产中可做完整滑块组件
      Taro.showModal({
        title: '人机验证',
        content: '点击确认完成验证',
        success: async (res) => {
          if (res.confirm) {
            try {
              const result = await verifyCaptcha({
                captchaId: captchaData.captchaId,
                x: captchaData.y || 50, // 简化处理
              })
              if (result.success && result.captchaToken) {
                setCaptchaToken(result.captchaToken)
                setCaptchaVerified(true)
                Taro.showToast({ title: '验证通过', icon: 'success' })
              } else {
                Taro.showToast({ title: result.msg || '验证失败', icon: 'none' })
              }
            } catch {
              Taro.showToast({ title: '验证失败，请重试', icon: 'none' })
            }
          }
        },
      })
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '获取验证码失败', icon: 'none' })
    }
  }

  const handleRegister = async () => {
    if (!username.trim()) {
      Taro.showToast({ title: '请输入账号', icon: 'none' })
      return
    }
    if (username.trim().length < 3) {
      Taro.showToast({ title: '账号至少3个字符', icon: 'none' })
      return
    }
    if (!password || password.length < 6) {
      Taro.showToast({ title: '密码至少6位', icon: 'none' })
      return
    }
    if (password !== confirmPassword) {
      Taro.showToast({ title: '两次密码不一致', icon: 'none' })
      return
    }
    if (!captchaToken) {
      Taro.showToast({ title: '请先完成验证', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      await register({
        username: username.trim(),
        password,
        role,
        captchaToken,
      })
      Taro.showToast({ title: '注册成功', icon: 'success' })
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('注册失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="register-page">
      <View className="register-header">
        <Text className="header-title">创建账号</Text>
        <Text className="header-desc">注册后即可预订酒店</Text>
      </View>

      <View className="register-form">
        <View className="form-item">
          <Text className="form-label">账号</Text>
          <Input
            className="form-input"
            placeholder="请输入账号（至少3个字符）"
            value={username}
            onInput={(e) => setUsername(e.detail.value)}
          />
        </View>

        <View className="form-item">
          <Text className="form-label">密码</Text>
          <Input
            className="form-input"
            placeholder="请输入密码（至少6位）"
            password
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>

        <View className="form-item">
          <Text className="form-label">确认密码</Text>
          <Input
            className="form-input"
            placeholder="请再次输入密码"
            password
            value={confirmPassword}
            onInput={(e) => setConfirmPassword(e.detail.value)}
          />
        </View>

        <Picker
          mode="selector"
          range={ROLE_OPTIONS}
          onChange={(e) => {
            const label = ROLE_OPTIONS[Number(e.detail.value)]
            setRoleLabel(label)
            setRole(ROLE_VALUES[label])
          }}
        >
          <View className="form-item">
            <Text className="form-label">角色</Text>
            <Text className="form-value">{roleLabel} ▾</Text>
          </View>
        </Picker>

        <View className="captcha-row">
          <View
            className={`captcha-btn ${captchaVerified ? 'verified' : ''}`}
            onClick={!captchaVerified ? handleVerifyCaptcha : undefined}
          >
            <Text>{captchaVerified ? '✓ 已验证' : '点击进行人机验证'}</Text>
          </View>
        </View>

        <View
          className={`register-btn ${loading ? 'disabled' : ''}`}
          onClick={!loading ? handleRegister : undefined}
        >
          <Text>{loading ? '注册中...' : '注册'}</Text>
        </View>

        <View className="register-footer">
          <Text className="footer-text">已有账号？</Text>
          <Text className="footer-link" onClick={() => Taro.navigateBack()}>去登录</Text>
        </View>
      </View>
    </View>
  )
}


