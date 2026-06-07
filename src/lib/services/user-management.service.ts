import { createAdminClient } from '@/lib/supabase/admin';
import type {
  UserProfile,
  UserRole,
  PaginationInput,
  PaginatedResult,
} from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
}

export type UserManagementError =
  | 'invalid_email'
  | 'invalid_password'
  | 'invalid_role'
  | 'email_taken'
  | 'last_admin'
  | 'user_not_found'
  | 'system_error';

export interface UserResult {
  success: boolean;
  user?: UserProfile;
  error?: UserManagementError;
  message?: string;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IUserManagementService {
  createUser(data: CreateUserInput): Promise<UserResult>;
  listUsers(pagination: PaginationInput): Promise<PaginatedResult<UserProfile>>;
  changeUserRole(userId: string, newRole: UserRole): Promise<UserResult>;
}

// ─── Validation Helpers ─────────────────────────────────────────────────────

/**
 * Validates an email address against a simplified RFC 5322 pattern.
 * Checks for: local part @ domain with at least one dot in the domain.
 * Max length: 254 characters.
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  // Simplified RFC 5322 regex — covers the vast majority of valid addresses
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validates password length: between 8 and 128 characters inclusive.
 */
export function isValidPassword(password: string): boolean {
  if (!password) return false;
  return password.length >= 8 && password.length <= 128;
}

/**
 * Validates that a role is either 'admin' or 'customer'.
 */
export function isValidRole(role: string): role is UserRole {
  return role === 'admin' || role === 'customer';
}

// ─── Internal Row Type ──────────────────────────────────────────────────────

/** Shape of a row returned from the profiles table select query. */
interface ProfileRow {
  id: string;
  email: string;
  role: 'admin' | 'customer';
  created_at: string;
}

// ─── Service Implementation ─────────────────────────────────────────────────

export class UserManagementService implements IUserManagementService {
  /**
   * Creates a new user with the specified email, password, and role.
   * Uses the admin Supabase client to bypass RLS and create users directly.
   *
   * The database trigger will create a profile with 'customer' as the default role.
   * If the requested role is 'admin', we update the profile after creation.
   */
  async createUser(data: CreateUserInput): Promise<UserResult> {
    // Validate inputs
    if (!isValidEmail(data.email)) {
      return { success: false, error: 'invalid_email', message: 'Email must be a valid RFC 5322 format (max 254 characters).' };
    }

    if (!isValidPassword(data.password)) {
      return { success: false, error: 'invalid_password', message: 'Password must be between 8 and 128 characters.' };
    }

    if (!isValidRole(data.role)) {
      return { success: false, error: 'invalid_role', message: 'Role must be either "admin" or "customer".' };
    }

    const supabase = createAdminClient();

    try {
      // Create the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true, // Auto-confirm for admin-created users
      });

      if (authError) {
        // Supabase returns a specific error when email is already taken
        if (
          authError.message?.toLowerCase().includes('already') ||
          authError.message?.toLowerCase().includes('duplicate') ||
          authError.message?.toLowerCase().includes('exists')
        ) {
          return { success: false, error: 'email_taken', message: 'A user with this email already exists.' };
        }
        return { success: false, error: 'system_error', message: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'system_error', message: 'User creation did not return a user object.' };
      }

      const userId = authData.user.id;

      // If the role is 'admin', update the profile (trigger creates with 'customer' default)
      if (data.role === 'admin') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'admin' } as never)
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to update user role to admin:', updateError.message);
          return {
            success: false,
            error: 'system_error',
            message: 'User created but role assignment failed. Please update the role manually.',
          };
        }
      }

      // Fetch the profile to return complete data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        // User was created but we couldn't fetch the profile
        return {
          success: true,
          user: {
            id: userId,
            email: data.email,
            role: data.role,
            createdAt: new Date(),
          },
        };
      }

      const row = profile as unknown as ProfileRow;
      return {
        success: true,
        user: {
          id: row.id,
          email: row.email,
          role: row.role,
          createdAt: new Date(row.created_at),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: 'system_error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      };
    }
  }

  /**
   * Lists all users with pagination.
   * Returns paginated user profiles ordered by creation date descending.
   */
  async listUsers(pagination: PaginationInput): Promise<PaginatedResult<UserProfile>> {
    const { page, pageSize = 20 } = pagination;
    const supabase = createAdminClient();

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Get total count
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to count users: ${countError.message}`);
    }

    const total = count ?? 0;

    // Get paginated results
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as ProfileRow[];
    const users: UserProfile[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      createdAt: new Date(row.created_at),
    }));

    return {
      data: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Changes a user's role.
   * Enforces the last-admin guard: if the user is the last admin and the new role
   * is 'customer', the change is rejected.
   */
  async changeUserRole(userId: string, newRole: UserRole): Promise<UserResult> {
    if (!isValidRole(newRole)) {
      return { success: false, error: 'invalid_role', message: 'Role must be either "admin" or "customer".' };
    }

    const supabase = createAdminClient();

    try {
      // Fetch the current user profile
      const { data: currentUserData, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .eq('id', userId)
        .single();

      if (fetchError || !currentUserData) {
        return { success: false, error: 'user_not_found', message: 'User not found.' };
      }

      const currentUser = currentUserData as unknown as ProfileRow;

      // If role is already the same, no change needed
      if (currentUser.role === newRole) {
        return {
          success: true,
          user: {
            id: currentUser.id,
            email: currentUser.email,
            role: currentUser.role,
            createdAt: new Date(currentUser.created_at),
          },
        };
      }

      // Last-admin guard: if changing from admin to customer, check admin count
      if (currentUser.role === 'admin' && newRole === 'customer') {
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin');

        if (countError) {
          return { success: false, error: 'system_error', message: 'Failed to verify admin count.' };
        }

        if ((count ?? 0) <= 1) {
          return {
            success: false,
            error: 'last_admin',
            message: 'Cannot change role: at least one admin account must exist.',
          };
        }
      }

      // Perform the role update
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: newRole } as never)
        .eq('id', userId);

      if (updateError) {
        return { success: false, error: 'system_error', message: updateError.message };
      }

      return {
        success: true,
        user: {
          id: currentUser.id,
          email: currentUser.email,
          role: newRole,
          createdAt: new Date(currentUser.created_at),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: 'system_error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      };
    }
  }
}

// Export a singleton instance for use across the application
export const userManagementService = new UserManagementService();
