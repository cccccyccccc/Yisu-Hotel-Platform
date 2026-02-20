import request from './request'

// 公告类型
export type AnnouncementType = 'info' | 'success' | 'warning'
export type AnnouncementPriority = 'high' | 'medium' | 'low'

// 公告列表项
export interface AnnouncementListItem {
  _id: string
  title: string
  type: AnnouncementType
  createdAt: string
  priority: AnnouncementPriority
  content?: string
}

// 公告详情
export interface Announcement {
  _id: string
  title: string
  content: string
  type: AnnouncementType
  priority: AnnouncementPriority
  status: number
  createdBy?: {
    _id: string
    username: string
  }
  createdAt: string
  updatedAt: string
}

function toPriority(type: AnnouncementType): AnnouncementPriority {
  if (type === 'warning') return 'high'
  if (type === 'success') return 'medium'
  return 'low'
}

// 获取上线公告列表
export async function getAnnouncements(): Promise<AnnouncementListItem[]> {
  const list = await request<Array<{
    _id: string
    title: string
    type: AnnouncementType
    createdAt: string
  }>>({
    url: '/announcements',
    method: 'GET'
  })

  return list.map((item) => ({
    ...item,
    priority: toPriority(item.type),
    content: ''
  }))
}

// 获取公告详情
export async function getAnnouncementDetail(id: string): Promise<Announcement> {
  const detail = await request<Omit<Announcement, 'priority'>>({
    url: `/announcements/${id}`,
    method: 'GET'
  })
  return {
    ...detail,
    priority: toPriority(detail.type)
  }
}

