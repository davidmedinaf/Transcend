import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AuthResult, Session, UserRole } from '@/lib/types';

/**
 * IAuthService interface — extractable to NestJS in the future.
 */
export interface IAuthService {
  register(email: string, password: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  logout(sessionToken: string): Promise<void>;
  validateSession(token: string): Promise<SessionInfo | null>;
  getUserRole(userId: string): Promise<UserRole | null>;
}

export interface SessionInfo {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * RFC 5322 compliant email regex.
 * Validates standard email formats with proper local-part and domain rules.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validates an email address against RFC 5322 format.
 * Also enforces max 254 characters (RFC 5321 path limit).
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Validates password length: 8-128 characters inclusive.
 */
export function isValidPassword(password: string): boolean {
  if (!password) return false;
  return password.length >= 8 && password.length <= 128;
}

/**
 * AuthService implementation using Supabase Auth.
 * Handles registration, login, logout, session validation, and role retrieval.
 */
export class AuthService implements IAuthService {
  /**
   * Register a new user with email and password.
   * Validates input, delegates to Supabase Auth signUp, returns typed AuthResult.
   *
   * Requirements: 1.1, 1.3, 1.5
   */
  async register(email: string, password: string): Promise<AuthResult> {
    // Input validation
    if (!isValidEmail(email)) {
      return { success: false, error: 'invalid_email' };
    }
    if (!isValidPassword(password)) {
      return { success: false, error: 'invalid_password' };
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      // Supabase returns specific error for duplicate email
      if (
        error.message?.toLowerCase().includes('user already registered') ||
        error.message?.toLowerCase().includes('already been registered') ||
        (error as unknown as { code?: string }).code === 'user_already_exists'
      ) {
        return { success: false, error: 'email_taken' };
      }
      // Generic fallback — could be rate limiting or other server error
      return { success: false, error: 'invalid_credentials' };
    }

    if (!data.user) {
      return { success: false, error: 'invalid_credentials' };
    }

    // If email confirmation is enabled, session will be null but user exists.
    // For POC, we auto-login after signup using signInWithPassword.
    let activeSession = data.session;
    if (!activeSession) {
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (loginError || !loginData.session) {
        return { success: false, error: 'invalid_credentials' };
      }
      activeSession = loginData.session;
    }

    const role = await this.getUserRole(data.user.id);

    const session: Session = {
      token: activeSession.access_token,
      expiresAt: new Date(activeSession.expires_at! * 1000),
      user: {
        id: data.user.id,
        email: data.user.email!,
        role: role ?? 'customer',
      },
    };

    return { success: true, session };
  }

  /**
   * Login with email and password.
   * Returns session with 1-hour expiry on success.
   *
   * Requirements: 2.1, 2.2
   */
  async login(email: string, password: string): Promise<AuthResult> {
    // Input validation
    if (!isValidEmail(email)) {
      return { success: false, error: 'invalid_credentials' };
    }
    if (!isValidPassword(password)) {
      return { success: false, error: 'invalid_credentials' };
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Generic error — don't reveal if email or password was wrong
      if (error.message?.toLowerCase().includes('invalid login credentials')) {
        return { success: false, error: 'invalid_credentials' };
      }
      // Account lockout (if Supabase rate limiting kicks in)
      if (
        error.status === 429 ||
        error.message?.toLowerCase().includes('locked') ||
        error.message?.toLowerCase().includes('too many')
      ) {
        return { success: false, error: 'account_locked' };
      }
      return { success: false, error: 'invalid_credentials' };
    }

    if (!data.session || !data.user) {
      return { success: false, error: 'invalid_credentials' };
    }

    const role = await this.getUserRole(data.user.id);

    const session: Session = {
      token: data.session.access_token,
      expiresAt: new Date(data.session.expires_at! * 1000),
      user: {
        id: data.user.id,
        email: data.user.email!,
        role: role ?? 'customer',
      },
    };

    return { success: true, session };
  }

  /**
   * Logout by invalidating the current session.
   *
   * Requirements: 1.3
   */
  async logout(_sessionToken: string): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  /**
   * Validate a session token and return user info.
   * Used by middleware to check auth state.
   *
   * Requirements: 13.4, 13.5, 13.6
   */
  async validateSession(token: string): Promise<SessionInfo | null> {
    if (!token) return null;

    const adminClient = createAdminClient();

    const {
      data: { user },
      error,
    } = await adminClient.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    const role = await this.getUserRole(user.id);
    if (!role) return null;

    return {
      userId: user.id,
      email: user.email!,
      role,
    };
  }

  /**
   * Get the role for a user by querying the profiles table.
   *
   * Requirements: 2.1, 13.4
   */
  async getUserRole(userId: string): Promise<UserRole | null> {
    if (!userId) return null;

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single<{ role: string }>();

    if (error || !data) {
      return null;
    }

    return data.role as UserRole;
  }
}

/**
 * Singleton instance for use across the application.
 */
export const authService = new AuthService();
