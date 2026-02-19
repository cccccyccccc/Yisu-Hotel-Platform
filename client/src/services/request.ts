import Taro from '@tarojs/taro'

// API 基础地址
const BASE_URL = 'http://localhost:5000/api'

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
}

export interface ApiResponse<T = unknown> {
  data: T
  statusCode: number
  header: Record<string, string>
}

export interface ApiError {
  statusCode: number
  message: string
  data?: unknown
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
    const errorMsg = (response.data as { msg?: string; message?: string })?.msg
      || (response.data as { msg?: string; message?: string })?.message
      || '请求失败'

    if (response.statusCode === 401) {
      Taro.removeStorageSync('token')
      Taro.removeStorageSync('user')
      Taro.showToast({ title: '请重新登录', icon: 'none' })
      // 跳转到登录页
      setTimeout(() => {
        Taro.navigateTo({ url: '/pages/login/index' })
      }, 1500)
    } else if (response.statusCode === 403) {
      Taro.showToast({ title: '无权限访问', icon: 'none' })
    } else if (response.statusCode === 404) {
      Taro.showToast({ title: '资源不存在', icon: 'none' })
    } else {
      Taro.showToast({ title: errorMsg, icon: 'none' })
    }

    const error: ApiError = {
      statusCode: response.statusCode,
      message: errorMsg,
      data: response.data
    }
    throw error
  } catch (error) {
    // 网络错误
    if (!(error as ApiError).statusCode) {
      Taro.showToast({ title: '网络错误，请检查网络连接', icon: 'none' })
    }
    console.error('Request error:', error)
    throw error
  }
}

// 上传文件封装
export async function uploadFile(filePath: string): Promise<{ url: string }> {
  const token = Taro.getStorageSync('token')

  return new Promise((resolve, reject) => {
    Taro.uploadFile({
      url: `${BASE_URL}/upload`,
      filePath,
      name: 'file',
      header: {
        Authorization: token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const data = JSON.parse(res.data)
          resolve(data)
        } else {
          Taro.showToast({ title: '上传失败', icon: 'none' })
          reject(new Error('Upload failed'))
        }
      },
      fail: (err) => {
        Taro.showToast({ title: '上传失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

export default request

