import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createHotel,
  getMyHotels,
  updateHotel,
  getAdminHotelList,
  auditHotel,
  updateHotelStatus,
  getHotelDetail,
} from '@/api/hotels';
import request from '@/api/request';

// Mock the request module
vi.mock('@/api/request', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('Hotels API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockHotel = {
    _id: 'hotel123',
    name: '测试酒店',
    city: '北京',
    address: '测试地址',
    starRating: 5,
    price: 500,
    status: 0 as const,
    merchantId: 'merchant123',
  };

  describe('createHotel', () => {
    it('should call POST /api/hotels with hotel data', async () => {
      vi.mocked(request.post).mockResolvedValue({ data: mockHotel });

      const hotelData = {
        name: '测试酒店',
        city: '北京',
        address: '测试地址',
        starRating: 5,
        price: 500,
        location: { type: 'Point' as const, coordinates: [116.4, 39.9] as [number, number] },
      };
      await createHotel(hotelData);

      expect(request.post).toHaveBeenCalledWith('/api/hotels', hotelData);
    });
  });

  describe('getMyHotels', () => {
    it('should call GET /api/hotels/my', async () => {
      vi.mocked(request.get).mockResolvedValue({ data: [mockHotel] });

      const result = await getMyHotels();

      expect(request.get).toHaveBeenCalledWith('/api/hotels/my');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('updateHotel', () => {
    it('should call PUT /api/hotels/:id with updates', async () => {
      vi.mocked(request.put).mockResolvedValue({ data: mockHotel });

      const updates = { name: '新名称' };
      await updateHotel('hotel123', updates);

      expect(request.put).toHaveBeenCalledWith('/api/hotels/hotel123', updates);
    });
  });

  describe('getAdminHotelList', () => {
    it('should call GET /api/hotels/admin/list', async () => {
      vi.mocked(request.get).mockResolvedValue({ data: [mockHotel] });

      await getAdminHotelList();

      expect(request.get).toHaveBeenCalledWith('/api/hotels/admin/list');
    });
  });

  describe('auditHotel', () => {
    it('should call PUT /api/hotels/:id/audit with status', async () => {
      vi.mocked(request.put).mockResolvedValue({ data: { msg: 'Approved' } });

      await auditHotel('hotel123', { status: 1 });

      expect(request.put).toHaveBeenCalledWith('/api/hotels/hotel123/audit', { status: 1 });
    });

    it('should include reject reason when rejecting', async () => {
      vi.mocked(request.put).mockResolvedValue({ data: { msg: 'Rejected' } });

      await auditHotel('hotel123', { status: 2, rejectReason: '信息不完整' });

      expect(request.put).toHaveBeenCalledWith('/api/hotels/hotel123/audit', {
        status: 2,
        rejectReason: '信息不完整',
      });
    });
  });

  describe('updateHotelStatus', () => {
    it('should call PUT /api/hotels/:id/status', async () => {
      vi.mocked(request.put).mockResolvedValue({ data: mockHotel });

      await updateHotelStatus('hotel123', 3);

      expect(request.put).toHaveBeenCalledWith('/api/hotels/hotel123/status', { status: 3 });
    });
  });

  describe('getHotelDetail', () => {
    it('should call GET /api/hotels/:id', async () => {
      vi.mocked(request.get).mockResolvedValue({ data: mockHotel });

      const result = await getHotelDetail('hotel123');

      expect(request.get).toHaveBeenCalledWith('/api/hotels/hotel123');
      expect(result.data).toEqual(mockHotel);
    });
  });
});
