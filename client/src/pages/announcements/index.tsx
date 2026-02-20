import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { getAnnouncements, type AnnouncementListItem } from '../../services'
import './index.scss'

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  high: { label: '重要', color: '#ff4d4f' },
  medium: { label: '一般', color: '#faad14' },
  low: { label: '普通', color: '#52c41a' },
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getTimeDiff(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return formatDate(dateStr)
}

export default function Announcements() {
  const [list, setList] = useState<AnnouncementListItem[]>([])
  const [loading, setLoading] = useState(true)

  useLoad(() => {
    loadAnnouncements()
  })

  const loadAnnouncements = async () => {
    setLoading(true)
    try {
      const data = await getAnnouncements()
      setList(data)
    } catch {
      console.error('获取公告失败')
    } finally {
      setLoading(false)
    }
  }

  const goDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/announcement-detail/index?id=${id}` })
  }

  return (
    <View className="announcements-page">
      {loading ? (
        <View className="empty-state"><Text>加载中...</Text></View>
      ) : list.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-icon">📭</Text>
          <Text className="empty-text">暂无公告</Text>
        </View>
      ) : (
        <View className="announcement-list">
          {list.map(item => {
            const pInfo = PRIORITY_MAP[item.priority] || PRIORITY_MAP.low
            return (
              <View key={item._id} className="announcement-card" onClick={() => goDetail(item._id)}>
                <View className="card-header">
                  <View className="priority-tag" style={{ background: pInfo.color }}>
                    <Text>{pInfo.label}</Text>
                  </View>
                  <Text className="card-time">{getTimeDiff(item.createdAt)}</Text>
                </View>
                <Text className="card-title">{item.title}</Text>
                <Text className="card-summary">
                  {(item.content || '').length > 80 ? `${(item.content || '').substring(0, 80)}...` : (item.content || '点击查看公告详情')}
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}


