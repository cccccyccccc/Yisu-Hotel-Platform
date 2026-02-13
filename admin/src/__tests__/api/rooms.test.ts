import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createRoom,
  getRoomsByHotel,
  updateRoom,
  deleteRoom,
} from '@/api/rooms';
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

describe('Rooms API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRoom = {
    _id: 'room123',
    hotelId: 'hotel123',
    title: '豪华大床房',
    price: 500,
    stock: 10,
    images: ['/uploads/room1.jpg'],
    facilities: ['WiFi', '空调'],
    maxGuests: 2,
    bedType: '大床',
  };

  describe('createRoom', () => {
    it('should call POST /api/rooms with room data', async () => {
      vi.mocked(request.post).mockResolvedValue({ data: mockRoom });

      const roomData = {
        hotelId: 'hotel123',
        title: '豪华大床房',
        price: 500,
        stock: 10,
      };
      await createRoom(roomData);

      expect(request.post).toHaveBeenCalledWith('/api/rooms', roomData);
    });
  });

  describe('getRoomsByHotel', () => {
    it('should call GET /api/rooms/:hotelId', async () => {
      vi.mocked(request.get).mockResolvedValue({ data: [mockRoom] });

      const result = await getRoomsByHotel('hotel123');

      expect(request.get).toHaveBeenCalledWith('/api/rooms/hotel123');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('updateRoom', () => {
    it('should call PUT /api/rooms/:id with updates', async () => {
      vi.mocked(request.put).mockResolvedValue({ data: mockRoom });

      const updates = { price: 600 };
      await updateRoom('room123', updates);

      expect(request.put).toHaveBeenCalledWith('/api/rooms/room123', updates);
    });
  });

  describe('deleteRoom', () => {
    it('should call DELETE /api/rooms/:id', async () => {
      vi.mocked(request.delete).mockResolvedValue({ data: { msg: 'Deleted' } });

      await deleteRoom('room123');

      expect(request.delete).toHaveBeenCalledWith('/api/rooms/room123');
    });
  });
});
