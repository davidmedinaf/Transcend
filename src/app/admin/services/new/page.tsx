'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';

type ServiceCategory = 'Recovery' | 'Treatments' | 'Coaching' | 'Events';

const CATEGORIES: ServiceCategory[] = ['Recovery', 'Treatments', 'Coaching', 'Events'];

interface FormData {
  name: string;
  description: string;
  duration: string;
  price: string;
  category: ServiceCategory;
  image: File | null;
}

interface FieldErrors {
  name?: string;
  description?: string;
  duration?: string;
  price?: string;
  category?: string;
  image?: string;
}

function validateForm(data: FormData): FieldErrors {
  const errors: FieldErrors = {};

  // Name: required, max 100 characters
  if (!data.name.trim()) {
    errors.name = 'Name is required';
  } else if (data.name.length > 100) {
    errors.name = 'Name must be at most 100 characters';
  }

  // Description: required, max 500 characters
  if (!data.description.trim()) {
    errors.description = 'Description is required';
  } else if (data.description.length > 500) {
    errors.description = 'Description must be at most 500 characters';
  }

  // Duration: required, integer 1-480
  const duration = parseInt(data.duration, 10);
  if (!data.duration.trim()) {
    errors.duration = 'Duration is required';
  } else if (isNaN(duration) || !Number.isInteger(duration)) {
    errors.duration = 'Duration must be a whole number';
  } else if (duration < 1 || duration > 480) {
    errors.duration = 'Duration must be between 1 and 480 minutes';
  }

  // Price: required, 0-9999.99
  const price = parseFloat(data.price);
  if (!data.price.trim()) {
    errors.price = 'Price is required';
  } else if (isNaN(price)) {
    errors.price = 'Price must be a valid number';
  } else if (price < 0 || price > 9999.99) {
    errors.price = 'Price must be between 0.00 and 9999.99';
  } else {
    // Check max 2 decimal places
    const parts = data.price.split('.');
    if (parts.length === 2 && parts[1].length > 2) {
      errors.price = 'Price can have at most 2 decimal places';
    }
  }

  // Category: must be valid
  if (!CATEGORIES.includes(data.category)) {
    errors.category = 'Please select a valid category';
  }

  return errors;
}

export default function AdminCreateServicePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    duration: '',
    price: '',
    category: 'Recovery',
    image: null,
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFormData((prev) => ({ ...prev, image: file }));
    if (fieldErrors.image) {
      setFieldErrors((prev) => ({ ...prev, image: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Client-side validation
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const body = new FormData();
      body.append('name', formData.name.trim());
      body.append('description', formData.description.trim());
      body.append('duration', formData.duration);
      body.append('price', formData.price);
      body.append('category', formData.category);
      if (formData.image) {
        body.append('image', formData.image);
      }

      const res = await fetch('/api/services', {
        method: 'POST',
        body,
      });

      if (!res.ok) {
        const json = await res.json();
        if (json.error?.details) {
          // Map server field errors
          setFieldErrors(json.error.details as FieldErrors);
        }
        setServerError(json.error?.message || 'Failed to create service');
        return;
      }

      // Success - redirect to service list
      router.push('/admin/services');
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/services"
          className="text-white/50 hover:text-white transition-colors duration-brand"
        >
          ← Back
        </Link>
        <h1 className="font-serif text-2xl text-transcend-gold">
          Create Service
        </h1>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-brand border border-red-500/50 bg-red-500/10 p-4 mb-6">
          <p className="text-sm text-red-400">{serverError}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-white/80 mb-1.5"
          >
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            maxLength={100}
            className={`w-full px-4 py-2.5 rounded-brand bg-white/5 border text-sm text-white placeholder-white/30 transition-colors duration-brand focus:outline-none focus:border-transcend-gold/50 ${
              fieldErrors.name ? 'border-red-500/50' : 'border-white/10'
            }`}
            placeholder="e.g. Sports Massage"
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>
          )}
          <p className="mt-1 text-xs text-white/40">
            {formData.name.length}/100 characters
          </p>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-white/80 mb-1.5"
          >
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            maxLength={500}
            rows={4}
            className={`w-full px-4 py-2.5 rounded-brand bg-white/5 border text-sm text-white placeholder-white/30 transition-colors duration-brand focus:outline-none focus:border-transcend-gold/50 resize-none ${
              fieldErrors.description ? 'border-red-500/50' : 'border-white/10'
            }`}
            placeholder="Describe the service..."
          />
          {fieldErrors.description && (
            <p className="mt-1 text-xs text-red-400">
              {fieldErrors.description}
            </p>
          )}
          <p className="mt-1 text-xs text-white/40">
            {formData.description.length}/500 characters
          </p>
        </div>

        {/* Duration & Price (side by side) */}
        <div className="grid grid-cols-2 gap-4">
          {/* Duration */}
          <div>
            <label
              htmlFor="duration"
              className="block text-sm font-medium text-white/80 mb-1.5"
            >
              Duration (minutes) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              min={1}
              max={480}
              step={1}
              className={`w-full px-4 py-2.5 rounded-brand bg-white/5 border text-sm text-white placeholder-white/30 transition-colors duration-brand focus:outline-none focus:border-transcend-gold/50 ${
                fieldErrors.duration ? 'border-red-500/50' : 'border-white/10'
              }`}
              placeholder="60"
            />
            {fieldErrors.duration && (
              <p className="mt-1 text-xs text-red-400">
                {fieldErrors.duration}
              </p>
            )}
          </div>

          {/* Price */}
          <div>
            <label
              htmlFor="price"
              className="block text-sm font-medium text-white/80 mb-1.5"
            >
              Price (EUR) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              min={0}
              max={9999.99}
              step={0.01}
              className={`w-full px-4 py-2.5 rounded-brand bg-white/5 border text-sm text-white placeholder-white/30 transition-colors duration-brand focus:outline-none focus:border-transcend-gold/50 ${
                fieldErrors.price ? 'border-red-500/50' : 'border-white/10'
              }`}
              placeholder="50.00"
            />
            {fieldErrors.price && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.price}</p>
            )}
          </div>
        </div>

        {/* Category */}
        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-white/80 mb-1.5"
          >
            Category <span className="text-red-400">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={`w-full px-4 py-2.5 rounded-brand bg-white/5 border text-sm text-white transition-colors duration-brand focus:outline-none focus:border-transcend-gold/50 ${
              fieldErrors.category ? 'border-red-500/50' : 'border-white/10'
            }`}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-[#1a1a1a] text-white">
                {cat}
              </option>
            ))}
          </select>
          {fieldErrors.category && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.category}</p>
          )}
        </div>

        {/* Image upload */}
        <div>
          <label
            htmlFor="image"
            className="block text-sm font-medium text-white/80 mb-1.5"
          >
            Image (optional)
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-brand border border-white/20 text-sm text-white/70 transition-colors duration-brand hover:border-transcend-gold/50 hover:text-white"
            >
              Choose File
            </button>
            <span className="text-sm text-white/50 truncate">
              {formData.image ? formData.image.name : 'No file chosen'}
            </span>
          </div>
          <input
            type="file"
            id="image"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          {fieldErrors.image && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.image}</p>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-brand bg-transcend-gold text-transcend-black text-sm font-medium transition-colors duration-brand hover:bg-transcend-gold/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create Service'}
          </button>
          <Link
            href="/admin/services"
            className="px-6 py-2.5 rounded-brand border border-white/20 text-sm text-white/70 transition-colors duration-brand hover:border-white/40"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
