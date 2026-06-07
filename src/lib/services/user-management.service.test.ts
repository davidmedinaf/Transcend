import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidEmail,
  isValidPassword,
  isValidRole,
  UserManagementService,
} from './user-management.service';

// ─── Validation Helper Tests ────────────────────────────────────────────────

describe('isValidEmail', () => {
  it('accepts a standard email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('accepts email with subdomain', () => {
    expect(isValidEmail('admin@mail.example.co.uk')).toBe(true);
  });

  it('accepts email with special chars in local part', () => {
    expect(isValidEmail('user.name+tag@example.com')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects missing @ symbol', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects missing local part', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('rejects email longer than 254 characters', () => {
    const longLocal = 'a'.repeat(243); // 243 + '@example.com' (12) = 255 chars
    expect(isValidEmail(`${longLocal}@example.com`)).toBe(false);
  });

  it('rejects email without TLD', () => {
    expect(isValidEmail('user@localhost')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts 8 character password (minimum)', () => {
    expect(isValidPassword('12345678')).toBe(true);
  });

  it('accepts 128 character password (maximum)', () => {
    expect(isValidPassword('a'.repeat(128))).toBe(true);
  });

  it('accepts a normal password', () => {
    expect(isValidPassword('SecureP@ss123')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidPassword('')).toBe(false);
  });

  it('rejects 7 character password (too short)', () => {
    expect(isValidPassword('1234567')).toBe(false);
  });

  it('rejects 129 character password (too long)', () => {
    expect(isValidPassword('a'.repeat(129))).toBe(false);
  });
});

describe('isValidRole', () => {
  it('accepts "admin"', () => {
    expect(isValidRole('admin')).toBe(true);
  });

  it('accepts "customer"', () => {
    expect(isValidRole('customer')).toBe(true);
  });

  it('rejects "superadmin"', () => {
    expect(isValidRole('superadmin')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidRole('')).toBe(false);
  });

  it('rejects "Admin" (case sensitive)', () => {
    expect(isValidRole('Admin')).toBe(false);
  });
});

// ─── Service Method Tests (with mocked Supabase) ────────────────────────────

// Mock Supabase admin client
const mockSupabase = {
  auth: {
    admin: {
      createUser: vi.fn(),
    },
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockSupabase,
}));

describe('UserManagementService', () => {
  let service: UserManagementService;

  beforeEach(() => {
    service = new UserManagementService();
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('rejects invalid email', async () => {
      const result = await service.createUser({
        email: 'not-an-email',
        password: 'validpass123',
        role: 'customer',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_email');
    });

    it('rejects short password', async () => {
      const result = await service.createUser({
        email: 'user@example.com',
        password: 'short',
        role: 'customer',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_password');
    });

    it('rejects invalid role', async () => {
      const result = await service.createUser({
        email: 'user@example.com',
        password: 'validpass123',
        role: 'superadmin' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_role');
    });

    it('creates a customer user successfully', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: userId,
              email: 'user@example.com',
              role: 'customer',
              created_at: '2024-01-01T00:00:00Z',
            },
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await service.createUser({
        email: 'user@example.com',
        password: 'validpass123',
        role: 'customer',
      });

      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('user@example.com');
      expect(result.user?.role).toBe('customer');
    });

    it('handles duplicate email error', async () => {
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' },
      });

      const result = await service.createUser({
        email: 'existing@example.com',
        password: 'validpass123',
        role: 'customer',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('email_taken');
    });
  });

  describe('changeUserRole', () => {
    it('rejects invalid role', async () => {
      const result = await service.changeUserRole('some-id', 'superadmin' as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_role');
    });

    it('returns user_not_found for non-existent user', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      const result = await service.changeUserRole('non-existent-id', 'admin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('user_not_found');
    });

    it('prevents changing the last admin to customer', async () => {
      const mockSelectForFetch = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'admin-id',
              email: 'admin@example.com',
              role: 'admin',
              created_at: '2024-01-01T00:00:00Z',
            },
            error: null,
          }),
        }),
      });

      const mockSelectForCount = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          count: 1,
          error: null,
        }),
      });

      // First call: fetch user profile, Second call: count admins
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { select: mockSelectForFetch };
        }
        return { select: mockSelectForCount };
      });

      const result = await service.changeUserRole('admin-id', 'customer');

      expect(result.success).toBe(false);
      expect(result.error).toBe('last_admin');
    });

    it('allows role change when multiple admins exist', async () => {
      const mockSelectForFetch = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'admin-id',
              email: 'admin@example.com',
              role: 'admin',
              created_at: '2024-01-01T00:00:00Z',
            },
            error: null,
          }),
        }),
      });

      const mockSelectForCount = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          count: 3,
          error: null,
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { select: mockSelectForFetch };
        }
        if (callCount === 2) {
          return { select: mockSelectForCount };
        }
        return { update: mockUpdate };
      });

      const result = await service.changeUserRole('admin-id', 'customer');

      expect(result.success).toBe(true);
      expect(result.user?.role).toBe('customer');
    });

    it('returns success without update when role is already the same', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'user-id',
                email: 'user@example.com',
                role: 'customer',
                created_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await service.changeUserRole('user-id', 'customer');

      expect(result.success).toBe(true);
      expect(result.user?.role).toBe('customer');
    });
  });
});
