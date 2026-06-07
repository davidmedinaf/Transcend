'use client';

import { useCallback, useEffect, useState } from 'react';

interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'customer';
  createdAt: string;
}

interface PaginatedUsers {
  data: UserProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface FormData {
  email: string;
  password: string;
  role: 'admin' | 'customer';
}

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  // User list state
  const [users, setUsers] = useState<PaginatedUsers | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Create user form state
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    role: 'customer',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Role change state
  const [roleChangeLoading, setRoleChangeLoading] = useState<string | null>(null);
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null);

  // Fetch users
  const fetchUsers = useCallback(async (page: number) => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/users?page=${page}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'Failed to fetch users.');
      }
      const data: PaginatedUsers = await res.json();
      setUsers(data);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to fetch users.');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage, fetchUsers]);

  // Create user handler
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormFieldErrors({});
    setFormSuccess(null);
    setFormSubmitting(true);

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!formData.email) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format.';
    } else if (formData.email.length > 254) {
      errors.email = 'Email must be at most 254 characters.';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    } else if (formData.password.length > 128) {
      errors.password = 'Password must be at most 128 characters.';
    }

    if (!['admin', 'customer'].includes(formData.role)) {
      errors.role = 'Role must be admin or customer.';
    }

    if (Object.keys(errors).length > 0) {
      setFormFieldErrors(errors);
      setFormSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        const code = errorData.error?.code;

        if (code === 'email_taken') {
          // Preserve form data on duplicate email error
          setFormError('A user with this email already exists.');
        } else if (code === 'invalid_email') {
          setFormFieldErrors({ email: errorData.error?.message || 'Invalid email format.' });
        } else if (code === 'invalid_password') {
          setFormFieldErrors({ password: errorData.error?.message || 'Invalid password.' });
        } else if (code === 'validation_error') {
          setFormError(errorData.error?.message || 'Validation error.');
          if (errorData.error?.details) {
            setFormFieldErrors(errorData.error.details);
          }
        } else {
          setFormError(errorData.error?.message || 'Failed to create user.');
        }
        setFormSubmitting(false);
        return;
      }

      // Success — clear form and refresh list
      setFormSuccess('User created successfully.');
      setFormData({ email: '', password: '', role: 'customer' });
      fetchUsers(currentPage);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setFormSubmitting(false);
    }
  }

  // Role change handler
  async function handleRoleChange(userId: string, newRole: 'admin' | 'customer') {
    setRoleChangeLoading(userId);
    setRoleChangeError(null);

    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        const code = errorData.error?.code;

        if (code === 'last_admin') {
          setRoleChangeError('Cannot change role: at least one admin account must exist.');
        } else {
          setRoleChangeError(errorData.error?.message || 'Failed to change role.');
        }
        setRoleChangeLoading(null);
        return;
      }

      // Refresh user list after successful role change
      fetchUsers(currentPage);
    } catch (err) {
      setRoleChangeError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setRoleChangeLoading(null);
    }
  }

  // Format date
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div>
      <h1 className="font-serif text-2xl text-transcend-gold mb-8">
        User Management
      </h1>

      {/* Create User Form */}
      <div className="rounded-brand border border-white/10 bg-white/5 p-6 mb-8">
        <h2 className="font-serif text-lg text-transcend-gold mb-4">
          Create User
        </h2>

        {formSuccess && (
          <div className="mb-4 rounded-brand bg-green-900/30 border border-green-500/30 px-4 py-3 text-sm text-green-300">
            {formSuccess}
          </div>
        )}

        {formError && (
          <div className="mb-4 rounded-brand bg-red-900/30 border border-red-500/30 px-4 py-3 text-sm text-red-300">
            {formError}
          </div>
        )}

        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm text-white/60 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full rounded-brand border bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-transcend-gold transition-colors duration-brand ${
                formFieldErrors.email ? 'border-red-500' : 'border-white/10'
              }`}
              placeholder="user@example.com"
            />
            {formFieldErrors.email && (
              <p className="mt-1 text-xs text-red-400">{formFieldErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm text-white/60 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={`w-full rounded-brand border bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-transcend-gold transition-colors duration-brand ${
                formFieldErrors.password ? 'border-red-500' : 'border-white/10'
              }`}
              placeholder="Min 8 characters"
            />
            {formFieldErrors.password && (
              <p className="mt-1 text-xs text-red-400">{formFieldErrors.password}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="block text-sm text-white/60 mb-1">
              Role
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'customer' })}
              className={`w-full rounded-brand border bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-transcend-gold transition-colors duration-brand ${
                formFieldErrors.role ? 'border-red-500' : 'border-white/10'
              }`}
            >
              <option value="customer" className="bg-[#1a1a1a]">Customer</option>
              <option value="admin" className="bg-[#1a1a1a]">Admin</option>
            </select>
            {formFieldErrors.role && (
              <p className="mt-1 text-xs text-red-400">{formFieldErrors.role}</p>
            )}
          </div>

          {/* Submit */}
          <div>
            <button
              type="submit"
              disabled={formSubmitting}
              className="w-full rounded-brand bg-transcend-gold px-4 py-2 text-sm font-medium text-black transition-colors duration-brand hover:bg-transcend-gold/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formSubmitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>

      {/* Role Change Error */}
      {roleChangeError && (
        <div className="mb-4 rounded-brand bg-red-900/30 border border-red-500/30 px-4 py-3 text-sm text-red-300">
          {roleChangeError}
          <button
            onClick={() => setRoleChangeError(null)}
            className="ml-3 text-red-400 hover:text-red-200 underline text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* User List */}
      <div className="rounded-brand border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="font-serif text-lg text-transcend-gold">
            Users
            {users && (
              <span className="text-sm text-white/40 font-sans ml-2">
                ({users.total} total)
              </span>
            )}
          </h2>
        </div>

        {listLoading && (
          <div className="px-6 py-12 text-center">
            <p className="text-white/40 text-sm">Loading users...</p>
          </div>
        )}

        {listError && (
          <div className="px-6 py-12 text-center">
            <p className="text-red-400 text-sm mb-3">{listError}</p>
            <button
              onClick={() => fetchUsers(currentPage)}
              className="rounded-brand border border-white/20 px-4 py-2 text-sm text-white/70 hover:text-white hover:border-white/40 transition-colors duration-brand"
            >
              Retry
            </button>
          </div>
        )}

        {!listLoading && !listError && users && (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-6 py-3 text-white/60 font-medium">Email</th>
                    <th className="px-6 py-3 text-white/60 font-medium">Role</th>
                    <th className="px-6 py-3 text-white/60 font-medium">Created</th>
                    <th className="px-6 py-3 text-white/60 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-white/40">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.data.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors duration-brand"
                      >
                        <td className="px-6 py-3 text-white">{user.email}</td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              user.role === 'admin'
                                ? 'bg-transcend-gold/20 text-transcend-gold'
                                : 'bg-white/10 text-white/70'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-white/60">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-3">
                          <select
                            value={user.role}
                            onChange={(e) =>
                              handleRoleChange(user.id, e.target.value as 'admin' | 'customer')
                            }
                            disabled={roleChangeLoading === user.id}
                            className="rounded-brand border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-transcend-gold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="customer" className="bg-[#1a1a1a]">
                              Customer
                            </option>
                            <option value="admin" className="bg-[#1a1a1a]">
                              Admin
                            </option>
                          </select>
                          {roleChangeLoading === user.id && (
                            <span className="ml-2 text-xs text-white/40">Saving...</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {users.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
                <p className="text-xs text-white/40">
                  Page {users.page} of {users.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="rounded-brand border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/30 transition-colors duration-brand disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(users.totalPages, p + 1))}
                    disabled={currentPage >= users.totalPages}
                    className="rounded-brand border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/30 transition-colors duration-brand disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
