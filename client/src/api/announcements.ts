import request from './request';

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning';
  status: number;
  createdBy?: {
    _id: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementListItem {
  _id: string;
  title: string;
  type: 'info' | 'success' | 'warning';
  createdAt: string;
}

// 获取上线公告列表
export const getAnnouncements = () => {
  return request.get<AnnouncementListItem[]>('/api/announcements');
};

// 获取公告详情
export const getAnnouncementDetail = (id: string) => {
  return request.get<Announcement>(`/api/announcements/${id}`);
};

// 管理员：获取所有公告列表
export const getAdminAnnouncementList = () => {
  return request.get<Announcement[]>('/api/announcements/admin/list');
};

// 管理员：创建公告
export const createAnnouncement = (data: { title: string; content: string; type: string; status?: number }) => {
  return request.post('/api/announcements', data);
};

// 管理员：更新公告
export const updateAnnouncement = (id: string, data: Partial<Announcement>) => {
  return request.put(`/api/announcements/${id}`, data);
};

// 管理员：删除公告
export const deleteAnnouncement = (id: string) => {
  return request.delete(`/api/announcements/${id}`);
};

// 获取未读公告数量
export const getUnreadAnnouncementCount = () => {
  return request.get<{ count: number }>('/api/announcements/unread/count');
};

// 标记公告为已读
export const markAnnouncementRead = (id: string) => {
  return request.post(`/api/announcements/${id}/read`);
};
