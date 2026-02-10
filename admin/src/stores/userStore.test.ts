import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUserStore } from '@/stores/userStore';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('userStore', () => {
  const mockUser = {
    _id: 'user123',
    username: 'testuser',
    role: 'merchant' as const,
  };
  const mockToken = 'test-jwt-token';

  beforeEach(() => {
    // Reset store state before each test
    useUserStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have null user initially', () => {
      const { user } = useUserStore.getState();
      expect(user).toBeNull();
    });

    it('should have null token initially', () => {
      const { token } = useUserStore.getState();
      expect(token).toBeNull();
    });

    it('should not be authenticated initially', () => {
      const { isAuthenticated } = useUserStore.getState();
      expect(isAuthenticated).toBe(false);
    });
  });

  describe('setUser', () => {
    it('should set user and token', () => {
      const { setUser } = useUserStore.getState();

      setUser(mockUser, mockToken);

      const state = useUserStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe(mockToken);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should save token to localStorage', () => {
      const { setUser } = useUserStore.getState();

      setUser(mockUser, mockToken);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', mockToken);
    });
  });

  describe('logout', () => {
    it('should clear user and token', () => {
      // First set a user
      useUserStore.setState({
        user: mockUser,
        token: mockToken,
        isAuthenticated: true,
      });

      const { logout } = useUserStore.getState();
      logout();

      const state = useUserStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should remove token from localStorage', () => {
      const { logout } = useUserStore.getState();

      logout();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('updateUser', () => {
    it('should update user fields', () => {
      // First set a user
      useUserStore.setState({
        user: mockUser,
        token: mockToken,
        isAuthenticated: true,
      });

      const { updateUser } = useUserStore.getState();
      updateUser({ username: 'newname' });

      const state = useUserStore.getState();
      expect(state.user?.username).toBe('newname');
      expect(state.user?._id).toBe('user123'); // Other fields unchanged
    });

    it('should not update if user is null', () => {
      const { updateUser } = useUserStore.getState();

      updateUser({ username: 'newname' });

      const state = useUserStore.getState();
      expect(state.user).toBeNull();
    });
  });
});
