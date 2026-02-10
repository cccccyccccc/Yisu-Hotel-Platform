import Taro from '@tarojs/taro'

// API 基础地址
const BASE_URL = 'http://localhost:3000/api'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
}

interface ApiResponse<T = unknown> {
  data: T
  statusCode: number
  header: Record<string, string>
}

// 请求封装
export async function request<T>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {} } = options

  // 获取 token
  const token = Taro.getStorageSync('token')
  if (token) {
    header['Authorization'] = `Bearer ${token}`
  }

  try {
    const response: ApiResponse<T> = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header
      }
    })

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.data
    }

    // 处理错误状态码
    if (response.statusCode === 401) {
      Taro.removeStorageSync('token')
      Taro.showToast({ title: '请重新登录', icon: 'none' })
    } else if (response.statusCode === 403) {
      Taro.showToast({ title: '无权限访问', icon: 'none' })
    } else {
      Taro.showToast({ title: '请求失败', icon: 'none' })
    }

    throw new Error(`Request failed with status ${response.statusCode}`)
  } catch (error) {
    console.error('Request error:', error)
    throw error
  }
}

export default request

