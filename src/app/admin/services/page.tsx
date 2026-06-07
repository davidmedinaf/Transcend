'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

interface ServiceItem {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  imageUrl: string | null;
  isActive: boolean;
}

interface PaginatedResponse {
  data: ServiceItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 20;

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/services?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) {
        throw new Error('Failed to fetch services');
      }
      const json: PaginatedResponse = await res.json();
      setServices(json.data);
      setTotalPages(json.totalPages);
      setTotal(json.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleDeleteClick = (id: string) => {
    setDeleteConfirmId(id);
    setDeleteError(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/services/${deleteConfirmId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const json = await res.json();
        const message =
          json.error?.message || 'Failed to delete service';
        setDeleteError(message);
        return;
      }

      setDeleteConfirmId(null);
      // Refresh list
      fetchServices();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'An error occurred while deleting'
      );
    } finally {
      setDeleting(false);
    }
  };

  // Group services by category for display
  const categoryOrder = ['Recovery', 'Treatments', 'Coaching', 'Events'];
  const servicesByCategory = categoryOrder.reduce<Record<string, ServiceItem[]>>(
    (acc, cat) => {
      const items = services.filter((s) => s.category === cat);
      if (items.length > 0) {
        acc[cat] = items;
      }
      return acc;
    },
    {}
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl text-transcend-gold">Services</h1>
        <Link
          href="/admin/services/new"
          className="px-4 py-2 rounded-brand bg-transcend-gold text-transcend-black text-sm font-medium transition-colors duration-brand hover:bg-transcend-gold/80"
        >
          Add Service
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-brand border border-red-500/50 bg-red-500/10 p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Delete error */}
      {deleteError && (
        <div className="rounded-brand border border-red-500/50 bg-red-500/10 p-4 mb-6">
          <p className="text-sm text-red-400">{deleteError}</p>
          <button
            onClick={() => setDeleteError(null)}
            className="text-xs text-red-300 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-brand border border-white/10 bg-[#1a1a1a] p-6 max-w-md w-full mx-4">
            <h3 className="font-serif text-lg text-transcend-gold mb-3">
              Confirm Delete
            </h3>
            <p className="text-sm text-white/70 mb-2">
              Are you sure you want to delete this service? This action cannot be
              undone.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleDeleteCancel}
                className="flex-1 px-4 py-2 rounded-brand border border-white/20 text-sm text-white/70 transition-colors duration-brand hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-brand bg-red-600 text-white text-sm font-medium transition-colors duration-brand hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-white/50 text-sm">Loading services...</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && services.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/50 text-sm mb-4">No services found.</p>
          <Link
            href="/admin/services/new"
            className="text-transcend-gold text-sm underline"
          >
            Create your first service
          </Link>
        </div>
      )}

      {/* Services organized by category */}
      {!loading && !error && services.length > 0 && (
        <div className="space-y-8">
          {Object.entries(servicesByCategory).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-sm font-medium text-transcend-gold/80 uppercase tracking-wider mb-3">
                {category}
              </h2>
              <div className="rounded-brand border border-white/10 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="text-left px-4 py-3 text-xs font-medium text-white/60 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-white/60 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-white/60 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-white/60 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((service) => (
                      <tr
                        key={service.id}
                        className="border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors duration-brand"
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm text-white">
                            {service.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-white/70">
                            {service.duration} min
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-white/70">
                            €{service.price.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/services/${service.id}/edit`}
                              className="px-3 py-1.5 rounded-brand border border-white/20 text-xs text-white/70 transition-colors duration-brand hover:border-transcend-gold/50 hover:text-transcend-gold"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDeleteClick(service.id)}
                              className="px-3 py-1.5 rounded-brand border border-red-500/30 text-xs text-red-400 transition-colors duration-brand hover:border-red-500/60 hover:bg-red-500/10"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
          <p className="text-xs text-white/50">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)} of {total} services
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-brand border border-white/20 text-xs text-white/70 transition-colors duration-brand hover:border-transcend-gold/50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-xs text-white/50">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-brand border border-white/20 text-xs text-white/70 transition-colors duration-brand hover:border-transcend-gold/50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
