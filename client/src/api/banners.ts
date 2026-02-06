import request from './request';

// Banner 类型定义
export interface Banner {
  _id: string;
  title: string;
  imageUrl: string;
  link?: string;
  sort: number;
  isActive: boolean;
  createdAt?: string;
}

export interface BannerCreateData {
  title: string;
  imageUrl: string;
  link?: string;
  sort?: number;
  isActive?: boolean;
}

// 获取轮播图列表（管理员）
export const getBannerList = () => {
  return request.get<Banner[]>('/api/banners/admin/list');
};

// 获取轮播图列表（前台展示）
export const getActiveBanners = () => {
  return request.get<Banner[]>('/api/banners');
};

// 创建轮播图
export const createBanner = (data: BannerCreateData) => {
  return request.post('/api/banners', data);
};

// 更新轮播图
export const updateBanner = (id: string, data: Partial<BannerCreateData>) => {
  return request.put(`/api/banners/${id}`, data);
};

// 删除轮播图
export const deleteBanner = (id: string) => {
  return request.delete(`/api/banners/${id}`);
};
