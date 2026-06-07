import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiCall,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  isApiSuccess,
  isApiError,
} from '@/lib/api-client';

// Mock window.location for 401 redirect tests
const mockLocation = { href: '' };
Object.defineProperty(global, 'window', {
  value: { location: mockLocation },
  writable: true,
});

describe('api-client', () => {
  beforeEach(() => {
    mockLocation.href = '';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('apiCall', () => {
    it('returns data on successful JSON response', async () => {
      const mockData = { id: '1', name: 'Test Service' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockData),
      });

      const result = await apiCall<typeof mockData>('/api/services');

      expect(result).toEqual({ data: mockData });
      expect(fetch).toHaveBeenCalledWith('/api/services', {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('sets Content-Type header to application/json by default', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await apiCall('/api/test');

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('returns structured ApiError from server on non-ok response', async () => {
      const serverError = {
        error: { code: 'validation_error', message: 'Name is required', details: { name: 'required' } },
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(serverError),
      });

      const result = await apiCall('/api/services');

      expect(result).toEqual({ error: serverError.error });
    });

    it('returns fallback error for unstructured error responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Internal error' }),
      });

      const result = await apiCall('/api/services');

      expect(result.error?.code).toBe('http_500');
      expect(result.error?.message).toContain('unexpected error');
    });

    it('redirects to /login on 401 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: { code: 'unauthorized', message: 'Unauthorized' } }),
      });

      const result = await apiCall('/api/bookings');

      expect(mockLocation.href).toBe('/login');
      expect(result.error?.code).toBe('session_expired');
    });

    it('handles network errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await apiCall('/api/services');

      expect(result.error?.code).toBe('network_error');
      expect(result.error?.message).toContain('Unable to connect');
    });

    it('handles non-TypeError exceptions gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Unknown error'));

      const result = await apiCall('/api/services');

      expect(result.error?.code).toBe('network_error');
      expect(result.error?.message).toContain('Unable to connect');
    });

    it('handles non-JSON response body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers({ 'content-type': 'text/plain' }),
      });

      const result = await apiCall('/api/auth/logout');

      expect(result).toEqual({ data: null });
    });

    it('merges custom headers with defaults', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await apiCall('/api/test', {
        headers: { 'X-Custom': 'value' },
      });

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
      });
    });
  });

  describe('apiGet', () => {
    it('calls apiCall with GET method', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ items: [] }),
      });

      const result = await apiGet<{ items: string[] }>('/api/services');

      expect(result).toEqual({ data: { items: [] } });
      expect(fetch).toHaveBeenCalledWith('/api/services', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('apiPost', () => {
    it('calls apiCall with POST method and JSON body', async () => {
      const body = { name: 'Test', price: 50 };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ id: '123', ...body }),
      });

      const result = await apiPost('/api/services', body);

      expect(result.data).toEqual({ id: '123', ...body });
      expect(fetch).toHaveBeenCalledWith('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    });

    it('handles POST with no body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }),
      });

      await apiPost('/api/seed');

      expect(fetch).toHaveBeenCalledWith('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: undefined,
      });
    });
  });

  describe('apiPut', () => {
    it('calls apiCall with PUT method and JSON body', async () => {
      const body = { name: 'Updated Name' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ id: '123', ...body }),
      });

      const result = await apiPut('/api/services/123', body);

      expect(result.data).toEqual({ id: '123', ...body });
      expect(fetch).toHaveBeenCalledWith('/api/services/123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    });
  });

  describe('apiDelete', () => {
    it('calls apiCall with DELETE method', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }),
      });

      const result = await apiDelete('/api/services/123');

      expect(result.data).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith('/api/services/123', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('type guards', () => {
    it('isApiSuccess identifies successful responses', () => {
      const success = { data: { id: '1' } };
      const failure = { error: { code: 'test', message: 'Error' } };

      expect(isApiSuccess(success)).toBe(true);
      expect(isApiSuccess(failure)).toBe(false);
    });

    it('isApiError identifies error responses', () => {
      const success = { data: { id: '1' } };
      const failure = { error: { code: 'test', message: 'Error' } };

      expect(isApiError(failure)).toBe(true);
      expect(isApiError(success)).toBe(false);
    });
  });
});
