import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHotelReviews } from '@/api/reviews';
import { getMerchantOrders } from '@/api/orders';
import request from '@/api/request';

// Mock the request module
vi.mock('@/api/request', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('Reviews API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHotelReviews', () => {
    it('should call GET /api/reviews/:hotelId', async () => {
      const mockReviews = [
        {
          _id: 'review1',
          userId: { _id: 'user1', username: 'testuser' },
          hotelId: 'hotel123',
          rating: 5,
          content: '很好的酒店',
          createdAt: '2024-01-01',
        },
      ];
      vi.mocked(request.get).mockResolvedValue({ data: mockReviews });

      const result = await getHotelReviews('hotel123');

      expect(request.get).toHaveBeenCalledWith('/api/reviews/hotel123');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].rating).toBe(5);
    });

    it('should return empty array for hotel with no reviews', async () => {
      vi.mocked(request.get).mockResolvedValue({ data: [] });

      const result = await getHotelReviews('hotel456');

      expect(result.data).toHaveLength(0);
    });
  });
});

describe('Orders API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMerchantOrders', () => {
    it('should call GET /api/orders/merchant', async () => {
      const mockOrders = [
        {
          _id: 'order1',
          userId: { _id: 'user1', username: 'guest' },
          hotelId: { _id: 'hotel1', name: '测试酒店', city: '北京' },
          roomTypeId: { _id: 'room1', title: '大床房', price: 300, stock: 10 },
          checkInDate: '2024-01-01',
          checkOutDate: '2024-01-02',
          quantity: 1,
          totalPrice: 300,
          status: 'paid',
          createdAt: '2024-01-01',
        },
      ];
      vi.mocked(request.get).mockResolvedValue({ data: mockOrders });

      const result = await getMerchantOrders();

      expect(request.get).toHaveBeenCalledWith('/api/orders/merchant');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('paid');
    });
  });
});
