import request from './request';

// 上传图片
export const uploadImage = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post<{ msg: string; url: string }>('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};
