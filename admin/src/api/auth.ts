import request from './request';

export interface LoginData {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  role: 'user' | 'merchant' | 'admin';
  gender?: 'male' | 'female' | 'unknown';
  bio?: string;
}

export interface User {
  _id: string;
  username: string;
  role: 'user' | 'merchant' | 'admin';
  gender?: string;
  avatar?: string;
  bio?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// 用户登录
export const login = (data: LoginData) => {
  return request.post<LoginResponse>('/api/auth/login', data);
};

// 用户注册
export const register = (data: RegisterData) => {
  return request.post('/api/auth/register', data);
};

// 获取个人资料
export const getProfile = () => {
  return request.get<User>('/api/users/profile');
};

// 修改个人资料
export const updateProfile = (data: Partial<User>) => {
  return request.put('/api/users/profile', data);
};
