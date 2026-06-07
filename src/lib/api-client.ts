'use client';

/**
 * Centralized API client utility for the Transcend Wellness app.
 * Provides typed fetch wrappers with consistent error handling,
 * session expiry detection, and network error recovery.
 *
 * Validates: Requirements 6.6, 7.8, 9.7, 10.5
 */

import type { ApiError } from '@/lib/types';

// ─── Response Types ─────────────────────────────────────────────────────────

/** Successful API response */
export interface ApiSuccess<T> {
  data: T;
  error?: never;
}

/** Failed API response */
export interface ApiFailure {
  data?: never;
  error: ApiError['error'];
}

/** Discriminated union for all API call results */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// ─── Core API Call ──────────────────────────────────────────────────────────

/**
 * Centralized API call utility with typed error handling.
 * Wraps fetch with:
 * - JSON parsing
 * - Consistent error format (ApiError)
 * - Network error detection with user-friendly messaging
 * - 401 detection with redirect to /login (session expired)
 */
export async function apiCall<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    // Handle session expiry — redirect to login
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return {
        error: {
          code: 'session_expired',
          message: 'Your session has expired. Please log in again.',
        },
      };
    }

    // Parse response body
    let body: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      body = await response.json();
    } else {
      body = null;
    }

    // Handle error responses
    if (!response.ok) {
      // If the API returned a structured error, use it
      if (body && typeof body === 'object' && 'error' in body) {
        const apiError = body as ApiError;
        return { error: apiError.error };
      }

      // Fallback for unstructured error responses
      return {
        error: {
          code: `http_${response.status}`,
          message: getDefaultErrorMessage(response.status),
        },
      };
    }

    // Success
    return { data: body as T };
  } catch (err: unknown) {
    // Network errors (no connectivity, DNS failure, CORS, etc.)
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return {
        error: {
          code: 'network_error',
          message: 'Unable to connect. Please check your internet connection and try again.',
        },
      };
    }

    // Generic catch-all for unexpected errors
    return {
      error: {
        code: 'network_error',
        message: 'Unable to connect. Please check your internet connection and try again.',
      },
    };
  }
}

// ─── HTTP Method Helpers ────────────────────────────────────────────────────

/** GET request with typed response */
export function apiGet<T>(
  url: string,
  options?: Omit<RequestInit, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, { ...options, method: 'GET' });
}

/** POST request with typed body and response */
export function apiPost<T>(
  url: string,
  body?: unknown,
  options?: Omit<RequestInit, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    ...options,
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** PUT request with typed body and response */
export function apiPut<T>(
  url: string,
  body?: unknown,
  options?: Omit<RequestInit, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    ...options,
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** DELETE request with typed response */
export function apiDelete<T>(
  url: string,
  options?: Omit<RequestInit, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, { ...options, method: 'DELETE' });
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Type guard to check if an API response is successful */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
  return 'data' in response && response.data !== undefined;
}

/** Type guard to check if an API response is a failure */
export function isApiError<T>(response: ApiResponse<T>): response is ApiFailure {
  return 'error' in response && response.error !== undefined;
}

/** Get a user-friendly default error message based on HTTP status */
function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'The request was invalid. Please check your input and try again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'A conflict occurred. The resource may have been modified.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'An unexpected error occurred. Please try again later.';
    case 503:
      return 'Service temporarily unavailable. Please try again shortly.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
