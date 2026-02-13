import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBannerList, createBanner, updateBanner, deleteBanner } from '@/api/banners';
import request from '@/api/request';

// Mock the request module
vi.mock('@/api/request', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Banners API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBanner = {
    _id: 'banner123',
    title: '春节特惠',
    imageUrl: '/uploads/banner1.jpg',
    linkUrl: '/promo/spring',
    sortOrder: 1,
    isActive: true,
    createdAt: '2024-01-01',
  };

  describe('getBannerList', () => {
    it('should call GET /api/banners/admin/list', async () => {
      vi.mocked(request.get).mockResolvedValue({ data: [mockBanner] });

      const result = await getBannerList();

      expect(request.get).toHaveBeenCalledWith('/api/banners/admin/list');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('createBanner', () => {
    it('should call POST /api/banners with banner data', async () => {
      vi.mocked(request.post).mockResolvedValue({ data: mockBanner });

      const bannerData = {
        title: '春节特惠',
        imageUrl: '/uploads/banner1.jpg',
        sortOrder: 1,
        isActive: true,
      };
      await createBanner(bannerData);

      expect(request.post).toHaveBeenCalledWith('/api/banners', bannerData);
    });
  });

  describe('updateBanner', () => {
    it('should call PUT /api/banners/:id with updates', async () => {
      vi.mocked(request.put).mockResolvedValue({ data: mockBanner });

      const updates = { title: '新标题' };
      await updateBanner('banner123', updates);

      expect(request.put).toHaveBeenCalledWith('/api/banners/banner123', updates);
    });
  });

  describe('deleteBanner', () => {
    it('should call DELETE /api/banners/:id', async () => {
      vi.mocked(request.delete).mockResolvedValue({ data: { msg: 'Deleted' } });

      await deleteBanner('banner123');

      expect(request.delete).toHaveBeenCalledWith('/api/banners/banner123');
    });
  });
});
