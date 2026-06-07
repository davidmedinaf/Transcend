import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { isValidEmail, isValidPassword, AuthService } from '@/lib/services/auth.service';

/**
 * Property-based tests for Authentication validation logic.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.4, 3.5**
 */

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * RFC 5322 email regex (same as used in the auth service).
 * We use it here as the "oracle" to verify the service's behavior matches.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function emailMatchesRFC5322(email: string): boolean {
  if (!email || email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

/** Characters valid in email local parts */
const LOCAL_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.!#$%&*+/=?^_`{|}~-';
const DOMAIN_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Generates a string from a given character set */
function stringFromChars(chars: string, minLength: number, maxLength: number) {
  return fc
    .array(fc.constantFrom(...chars.split('')), { minLength, maxLength })
    .map((arr) => arr.join(''));
}

/** Generates valid emails that conform to RFC 5322 */
const validEmailArb = fc
  .tuple(
    stringFromChars(LOCAL_CHARS, 1, 40),
    stringFromChars(DOMAIN_CHARS, 1, 10),
    stringFromChars(DOMAIN_CHARS, 2, 6)
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`)
  .filter((email) => emailMatchesRFC5322(email));

/** Generates valid passwords (8-128 characters) */
const validPasswordArb = fc.string({ minLength: 8, maxLength: 128 }).filter((p) => p.length >= 8);

/** Generates invalid passwords (too short or too long) */
const invalidPasswordArb = fc.oneof(
  fc.string({ minLength: 0, maxLength: 7 }),
  fc.string({ minLength: 129, maxLength: 200 })
);

/** Generates arbitrary strings that may or may not be valid emails */
const arbitraryStringArb = fc.string({ minLength: 0, maxLength: 300 });

// ─── Property 1: Registration input validation ─────────────────────────────

describe('Property 1: Registration input validation', () => {
  /**
   * **Validates: Requirements 1.1, 1.3, 1.5, 3.5**
   *
   * For any email string and password string, the registration system SHALL
   * accept the input if and only if the email matches RFC 5322 format AND the
   * password length is between 8 and 128 characters (inclusive).
   */

  it('isValidEmail accepts emails matching RFC 5322 pattern and rejects others', () => {
    fc.assert(
      fc.property(arbitraryStringArb, (email) => {
        const result = isValidEmail(email);
        const expected = emailMatchesRFC5322(email);
        expect(result).toBe(expected);
      }),
      { numRuns: 500 }
    );
  });

  it('isValidEmail always accepts well-formed valid emails', () => {
    fc.assert(
      fc.property(validEmailArb, (email) => {
        expect(isValidEmail(email)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('isValidPassword accepts passwords of 8-128 chars and rejects others', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 300 }), (password) => {
        const result = isValidPassword(password);
        const expected = password.length >= 8 && password.length <= 128;
        expect(result).toBe(expected);
      }),
      { numRuns: 500 }
    );
  });

  it('isValidPassword always accepts valid-length passwords', () => {
    fc.assert(
      fc.property(validPasswordArb, (password) => {
        expect(isValidPassword(password)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('isValidPassword always rejects invalid-length passwords', () => {
    fc.assert(
      fc.property(invalidPasswordArb, (password) => {
        expect(isValidPassword(password)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('register rejects invalid email with invalid_email error', async () => {
    const service = new AuthService();

    await fc.assert(
      fc.asyncProperty(
        arbitraryStringArb.filter((s) => !emailMatchesRFC5322(s)),
        validPasswordArb,
        async (email, password) => {
          const result = await service.register(email, password);
          expect(result.success).toBe(false);
          expect(result.error).toBe('invalid_email');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('register rejects invalid password with invalid_password error', async () => {
    const service = new AuthService();

    await fc.assert(
      fc.asyncProperty(validEmailArb, invalidPasswordArb, async (email, password) => {
        const result = await service.register(email, password);
        expect(result.success).toBe(false);
        expect(result.error).toBe('invalid_password');
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Duplicate email detection ──────────────────────────────────

describe('Property 2: Duplicate email detection', () => {
  /**
   * **Validates: Requirements 1.2, 3.4**
   *
   * For any valid email address that has been successfully registered, a
   * subsequent registration attempt with the same email SHALL be rejected
   * with an 'email_taken' error.
   */

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('re-registering the same email is always rejected with email_taken', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    const { createAdminClient } = await import('@/lib/supabase/admin');

    await fc.assert(
      fc.asyncProperty(validEmailArb, validPasswordArb, async (email, password) => {
        // Mock: first signUp succeeds, second returns user_already_exists
        let callCount = 0;
        const mockSignUp = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              data: {
                user: { id: 'user-123', email },
                session: {
                  access_token: 'token-abc',
                  expires_at: Math.floor(Date.now() / 1000) + 3600,
                },
              },
              error: null,
            });
          }
          // Second call: duplicate
          return Promise.resolve({
            data: { user: null, session: null },
            error: { message: 'User already registered', code: 'user_already_exists' },
          });
        });

        const mockSupabaseClient = { auth: { signUp: mockSignUp } };
        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        // Mock admin client for getUserRole
        const mockAdminClient = {
          auth: { getUser: vi.fn() },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: 'customer' }, error: null }),
              }),
            }),
          }),
        };
        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        const service = new AuthService();

        // First registration succeeds
        const firstResult = await service.register(email, password);
        expect(firstResult.success).toBe(true);

        // Second registration with same email is rejected
        const secondResult = await service.register(email, password);
        expect(secondResult.success).toBe(false);
        expect(secondResult.error).toBe('email_taken');
      }),
      { numRuns: 50 }
    );
  });
});

// ─── Property 3: Self-registration role assignment ──────────────────────────

describe('Property 3: Self-registration role assignment', () => {
  /**
   * **Validates: Requirements 1.4**
   *
   * For any successful self-registration, the resulting user profile SHALL
   * have the role set to 'customer', regardless of any other input parameters.
   */

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('all successful self-registrations result in customer role', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    const { createAdminClient } = await import('@/lib/supabase/admin');

    await fc.assert(
      fc.asyncProperty(validEmailArb, validPasswordArb, async (email, password) => {
        // Mock signUp success
        const mockSignUp = vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-' + email, email },
            session: {
              access_token: 'token-' + email,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        });

        const mockSupabaseClient = { auth: { signUp: mockSignUp } };
        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        // Mock getUserRole returning 'customer' (as set by the DB trigger)
        const mockAdminClient = {
          auth: { getUser: vi.fn() },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: 'customer' }, error: null }),
              }),
            }),
          }),
        };
        vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

        const service = new AuthService();
        const result = await service.register(email, password);

        expect(result.success).toBe(true);
        expect(result.session).toBeDefined();
        expect(result.session!.user.role).toBe('customer');
      }),
      { numRuns: 100 }
    );
  });
});
