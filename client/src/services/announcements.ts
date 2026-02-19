import request from './request'

// 公告类型
export type AnnouncementType = 'info' | 'success' | 'warning'

// 公告列表项
export interface AnnouncementListItem {
  _id: string
  title: string
  type: AnnouncementType
  createdAt: string
}

// 公告详情
export interface Announcement {
  _id: string
  title: string
  content: string
  type: AnnouncementType
  status: number
  createdBy?: {
    _id: string
    username: string
  }
  createdAt: string
  updatedAt: string
}

// 获取上线公告列表
export function getAnnouncements(): Promise<AnnouncementListItem[]> {
  return request<AnnouncementListItem[]>({
    url: '/announcements',
    method: 'GET'
  })
}

// 获取公告详情
export function getAnnouncementDetail(id: string): Promise<Announcement> {
  return request<Announcement>({
    url: `/announcements/${id}`,
    method: 'GET'
  })
}

