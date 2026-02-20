import { View, Text } from '@tarojs/components'
import { useLoad, useRouter } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { getAnnouncementDetail, type Announcement } from '../../services'
import './index.scss'

function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  high: { label: '重要', color: '#ff4d4f' },
  medium: { label: '一般', color: '#faad14' },
  low: { label: '普通', color: '#52c41a' },
}

export default function AnnouncementDetail() {
  const router = useRouter()
  const id = router.params.id || ''
  const [detail, setDetail] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)

  useLoad(() => {
    if (id) {
      loadDetail()
    }
  })

  const loadDetail = async () => {
    setLoading(true)
    try {
      const data = await getAnnouncementDetail(id)
      setDetail(data)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <View className="loading-page"><Text>加载中...</Text></View>
  }

  if (!detail) {
    return <View className="loading-page"><Text>公告不存在</Text></View>
  }

  const pInfo = PRIORITY_MAP[detail.priority] || PRIORITY_MAP.low

  return (
    <View className="detail-page">
      <View className="detail-header">
        <View className="priority-tag" style={{ background: pInfo.color }}>
          <Text>{pInfo.label}</Text>
        </View>
        <Text className="detail-title">{detail.title}</Text>
        <Text className="detail-meta">
          发布时间：{formatDateTime(detail.createdAt)}
        </Text>
      </View>
      <View className="detail-content">
        <Text className="content-text">{detail.content}</Text>
      </View>
    </View>
  )
}


