import request from './request';

export interface UserProfile {
  _id: string;
  username: string;
  role: string;
  gender?: string;
  avatar?: string;
  bio?: string;
  createdAt?: string;
}

export interface UserListItem {
  _id: string;
  username: string;
  role: string;
  gender?: string;
  avatar?: string;
  createdAt: string;
}

// 获取当前用户资料
export const getUserProfile = () => {
  return request.get<UserProfile>('/api/users/profile');
};

// 更新用户资料
export const updateUserProfile = (data: { gender?: string; avatar?: string; bio?: string }) => {
  return request.put('/api/users/profile', data);
};

// 获取所有用户列表 (管理员)
export const getAdminUserList = () => {
  return request.get<UserListItem[]>('/api/users/admin/list');
};
