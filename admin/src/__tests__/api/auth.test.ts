import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, register, getProfile, updateProfile } from '@/api/auth';
import request from '@/api/request';

// Mock the request module
vi.mock('@/api/request', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should call POST /api/auth/login with credentials', async () => {
      const mockResponse = {
        data: {
          token: 'jwt-token',
          user: { _id: '123', username: 'test', role: 'merchant' },
        },
      };
      vi.mocked(request.post).mockResolvedValue(mockResponse);

      const result = await login({ username: 'test', password: '123456' });

      expect(request.post).toHaveBeenCalledWith('/api/auth/login', {
        username: 'test',
        password: '123456',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on invalid credentials', async () => {
      vi.mocked(request.post).mockRejectedValue(new Error('Invalid credentials'));

      await expect(login({ username: 'wrong', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should call POST /api/auth/register with user data', async () => {
      const mockResponse = { data: { msg: 'Registration successful' } };
      vi.mocked(request.post).mockResolvedValue(mockResponse);

      const userData = {
        username: 'newuser',
        password: '123456',
        role: 'merchant' as const,
        captchaToken: 'mock-captcha-token',
      };
      const result = await register(userData);

      expect(request.post).toHaveBeenCalledWith('/api/auth/register', userData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getProfile', () => {
    it('should call GET /api/users/profile', async () => {
      const mockUser = { _id: '123', username: 'test', role: 'merchant' };
      vi.mocked(request.get).mockResolvedValue({ data: mockUser });

      const result = await getProfile();

      expect(request.get).toHaveBeenCalledWith('/api/users/profile');
      expect(result.data).toEqual(mockUser);
    });
  });

  describe('updateProfile', () => {
    it('should call PUT /api/users/profile with updates', async () => {
      vi.mocked(request.put).mockResolvedValue({ data: { msg: 'Updated' } });

      const updates = { username: 'newname' };
      await updateProfile(updates);

      expect(request.put).toHaveBeenCalledWith('/api/users/profile', updates);
    });
  });
});
