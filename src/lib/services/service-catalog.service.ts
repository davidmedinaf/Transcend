import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Service,
  CreateServiceInput,
  UpdateServiceInput,
  ServiceCategory,
  PaginationInput,
  PaginatedResult,
} from '@/lib/types';

// ─── Validation Constants ───────────────────────────────────────────────────

const VALID_CATEGORIES: ServiceCategory[] = [
  'Recovery',
  'Treatments',
  'Coaching',
  'Events',
];

const CATEGORY_ORDER: Record<ServiceCategory, number> = {
  Recovery: 0,
  Treatments: 1,
  Coaching: 2,
  Events: 3,
};

// ─── Result Types ───────────────────────────────────────────────────────────

export interface ServiceResult {
  success: boolean;
  service?: Service;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IServiceCatalogService {
  createService(data: CreateServiceInput): Promise<ServiceResult>;
  updateService(id: string, data: UpdateServiceInput): Promise<ServiceResult>;
  deleteService(id: string): Promise<DeleteResult>;
  getServiceById(id: string): Promise<Service | null>;
  getServicesByCategory(): Promise<Map<ServiceCategory, Service[]>>;
  getAllServices(pagination: PaginationInput): Promise<PaginatedResult<Service>>;
}

// ─── Validation Helpers ─────────────────────────────────────────────────────

function validateName(name: string | undefined, required: boolean): string | null {
  if (required && (name === undefined || name === null)) return 'Name is required';
  if (name === undefined) return null;
  if (typeof name !== 'string') return 'Name must be a string';
  if (name.length < 1) return 'Name must be at least 1 character';
  if (name.length > 100) return 'Name must be at most 100 characters';
  return null;
}

function validateDescription(
  description: string | undefined,
  required: boolean
): string | null {
  if (required && (description === undefined || description === null))
    return 'Description is required';
  if (description === undefined) return null;
  if (typeof description !== 'string') return 'Description must be a string';
  if (description.length < 1) return 'Description must be at least 1 character';
  if (description.length > 500) return 'Description must be at most 500 characters';
  return null;
}

function validateDuration(duration: number | undefined, required: boolean): string | null {
  if (required && (duration === undefined || duration === null))
    return 'Duration is required';
  if (duration === undefined) return null;
  if (typeof duration !== 'number' || !Number.isInteger(duration))
    return 'Duration must be an integer';
  if (duration < 1) return 'Duration must be at least 1 minute';
  if (duration > 480) return 'Duration must be at most 480 minutes';
  return null;
}

function validatePrice(price: number | undefined, required: boolean): string | null {
  if (required && (price === undefined || price === null)) return 'Price is required';
  if (price === undefined) return null;
  if (typeof price !== 'number') return 'Price must be a number';
  if (price < 0) return 'Price must be at least 0.00';
  if (price > 9999.99) return 'Price must be at most 9999.99';
  // Check max 2 decimal places
  const decimalStr = price.toString();
  const decimalPart = decimalStr.includes('.') ? decimalStr.split('.')[1] : '';
  if (decimalPart.length > 2) return 'Price must have at most 2 decimal places';
  return null;
}

function validateCategory(
  category: ServiceCategory | undefined,
  required: boolean
): string | null {
  if (required && (category === undefined || category === null))
    return 'Category is required';
  if (category === undefined) return null;
  if (!VALID_CATEGORIES.includes(category))
    return `Category must be one of: ${VALID_CATEGORIES.join(', ')}`;
  return null;
}

function validateCreateInput(data: CreateServiceInput): Record<string, string> | null {
  const errors: Record<string, string> = {};

  const nameErr = validateName(data.name, true);
  if (nameErr) errors.name = nameErr;

  const descErr = validateDescription(data.description, true);
  if (descErr) errors.description = descErr;

  const durErr = validateDuration(data.duration, true);
  if (durErr) errors.duration = durErr;

  const priceErr = validatePrice(data.price, true);
  if (priceErr) errors.price = priceErr;

  const catErr = validateCategory(data.category, true);
  if (catErr) errors.category = catErr;

  return Object.keys(errors).length > 0 ? errors : null;
}

function validateUpdateInput(data: UpdateServiceInput): Record<string, string> | null {
  const errors: Record<string, string> = {};

  const nameErr = validateName(data.name, false);
  if (nameErr) errors.name = nameErr;

  const descErr = validateDescription(data.description, false);
  if (descErr) errors.description = descErr;

  const durErr = validateDuration(data.duration, false);
  if (durErr) errors.duration = durErr;

  const priceErr = validatePrice(data.price, false);
  if (priceErr) errors.price = priceErr;

  const catErr = validateCategory(data.category, false);
  if (catErr) errors.category = catErr;

  return Object.keys(errors).length > 0 ? errors : null;
}

// ─── DB Row Types ───────────────────────────────────────────────────────────

interface ServiceRow {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CategoryRow {
  id: string;
  name: string;
}

// ─── Row-to-Domain Mapper ───────────────────────────────────────────────────

function mapRowToService(row: ServiceRow, categoryName: ServiceCategory): Service {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    duration: row.duration_minutes,
    price: row.price,
    category: categoryName,
    imageUrl: row.image_url,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ─── Service Implementation ─────────────────────────────────────────────────

export class ServiceCatalogService implements IServiceCatalogService {
  /**
   * Creates a new service with full field validation.
   */
  async createService(data: CreateServiceInput): Promise<ServiceResult> {
    const fieldErrors = validateCreateInput(data);
    if (fieldErrors) {
      return { success: false, error: 'Validation failed', fieldErrors };
    }

    const supabase = await createClient();

    // Resolve category_id from category name
    const categoryId = await this.getCategoryId(data.category);
    if (!categoryId) {
      return { success: false, error: `Category '${data.category}' not found` };
    }

    // Handle image upload if provided
    let imageUrl: string | null = null;
    if (data.imageFile) {
      const uploadResult = await this.uploadImage(data.imageFile);
      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error };
      }
      imageUrl = uploadResult.url!;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase as any)
      .from('services')
      .insert({
        category_id: categoryId,
        name: data.name,
        description: data.description,
        duration_minutes: data.duration,
        price: data.price,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: (error as { message: string }).message };
    }

    return {
      success: true,
      service: mapRowToService(row as ServiceRow, data.category),
    };
  }

  /**
   * Updates a service's details. Existing bookings are not modified.
   */
  async updateService(id: string, data: UpdateServiceInput): Promise<ServiceResult> {
    const fieldErrors = validateUpdateInput(data);
    if (fieldErrors) {
      return { success: false, error: 'Validation failed', fieldErrors };
    }

    const supabase = await createClient();

    // Check service exists and get current category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase as any)
      .from('services')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: 'Service not found' };
    }

    const existingRow = existing as ServiceRow;

    // Build update payload
    const updatePayload: Partial<ServiceRow> = {};

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.duration !== undefined) updatePayload.duration_minutes = data.duration;
    if (data.price !== undefined) updatePayload.price = data.price;

    if (data.category !== undefined) {
      const categoryId = await this.getCategoryId(data.category);
      if (!categoryId) {
        return { success: false, error: `Category '${data.category}' not found` };
      }
      updatePayload.category_id = categoryId;
    }

    // Handle image upload if provided
    if (data.imageFile) {
      const uploadResult = await this.uploadImage(data.imageFile);
      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error };
      }
      updatePayload.image_url = uploadResult.url ?? null;
    }

    // Only update if there are fields to change
    const hasChanges = Object.keys(updatePayload).length > 0;
    if (!hasChanges) {
      const categoryName = await this.getCategoryNameById(existingRow.category_id);
      return {
        success: true,
        service: mapRowToService(existingRow, categoryName),
      };
    }

    updatePayload.updated_at = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase as any)
      .from('services')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: (error as { message: string }).message };
    }

    const updatedRow = row as ServiceRow;
    const finalCategoryId = updatePayload.category_id ?? existingRow.category_id;
    const categoryName = await this.getCategoryNameById(finalCategoryId);

    return {
      success: true,
      service: mapRowToService(updatedRow, categoryName),
    };
  }

  /**
   * Deletes a service. Rejects deletion if confirmed future bookings exist.
   */
  async deleteService(id: string): Promise<DeleteResult> {
    const supabase = await createClient();

    // Check for confirmed future bookings
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: futureBookings, error: bookingError } = await (supabase as any)
      .from('bookings')
      .select('id')
      .eq('service_id', id)
      .eq('status', 'confirmed')
      .gt('start_time', now)
      .limit(1);

    if (bookingError) {
      return { success: false, error: (bookingError as { message: string }).message };
    }

    if (futureBookings && (futureBookings as unknown[]).length > 0) {
      return {
        success: false,
        error: 'Cannot delete service with active future bookings',
      };
    }

    // Soft delete by marking inactive
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('services')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { success: false, error: (error as { message: string }).message };
    }

    return { success: true };
  }

  /**
   * Retrieves a single service by ID.
   */
  async getServiceById(id: string): Promise<Service | null> {
    const supabase = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase as any)
      .from('services')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !row) {
      return null;
    }

    const serviceRow = row as ServiceRow;
    const categoryName = await this.getCategoryNameById(serviceRow.category_id);
    return mapRowToService(serviceRow, categoryName);
  }

  /**
   * Returns all active services grouped by category with alphabetical sort within each.
   * Categories are ordered: Recovery → Treatments → Coaching → Events.
   */
  async getServicesByCategory(): Promise<Map<ServiceCategory, Service[]>> {
    const supabase = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabase as any)
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error || !rows) {
      return new Map();
    }

    // Load all categories for mapping
    const categoryMap = await this.getCategoryMap();

    // Build ordered result map
    const result = new Map<ServiceCategory, Service[]>();

    // Initialize categories in correct order (Recovery → Treatments → Coaching → Events)
    const sortedCategories = [...VALID_CATEGORIES].sort(
      (a, b) => CATEGORY_ORDER[a] - CATEGORY_ORDER[b]
    );
    for (const cat of sortedCategories) {
      result.set(cat, []);
    }

    for (const row of rows as ServiceRow[]) {
      const categoryName = categoryMap.get(row.category_id);
      if (!categoryName) continue;
      const service = mapRowToService(row, categoryName);
      const list = result.get(categoryName);
      if (list) {
        list.push(service);
      }
    }

    // Remove empty categories
    for (const [cat, services] of result) {
      if (services.length === 0) {
        result.delete(cat);
      }
    }

    // Sort within each category alphabetically (case-insensitive)
    for (const [, services] of result) {
      services.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }

  /**
   * Returns a paginated list of all active services.
   */
  async getAllServices(pagination: PaginationInput): Promise<PaginatedResult<Service>> {
    const { page, pageSize } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = createAdminClient();

    // Get total count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: countError } = await (supabase as any)
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (countError) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const total = (count as number) ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    // Get paginated data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabase as any)
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(from, to);

    if (error || !rows) {
      return { data: [], total, page, pageSize, totalPages };
    }

    // Load categories for mapping
    const categoryMap = await this.getCategoryMap();

    const services = (rows as ServiceRow[]).map((row) => {
      const categoryName = categoryMap.get(row.category_id) ?? 'Recovery';
      return mapRowToService(row, categoryName);
    });

    return {
      data: services,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Resolves a category name to its database ID.
   */
  private async getCategoryId(category: ServiceCategory): Promise<string | null> {
    const supabase = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('service_categories')
      .select('id')
      .eq('name', category)
      .single();

    if (error || !data) {
      return null;
    }

    return (data as CategoryRow).id;
  }

  /**
   * Resolves a category_id to its category name.
   */
  private async getCategoryNameById(categoryId: string): Promise<ServiceCategory> {
    const supabase = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('service_categories')
      .select('name')
      .eq('id', categoryId)
      .single();

    if (error || !data) {
      return 'Recovery'; // fallback
    }

    return (data as { name: string }).name as ServiceCategory;
  }

  /**
   * Loads all category id → name mappings.
   */
  private async getCategoryMap(): Promise<Map<string, ServiceCategory>> {
    const supabase = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('service_categories')
      .select('id, name');

    const map = new Map<string, ServiceCategory>();
    if (error || !data) return map;

    for (const row of data as CategoryRow[]) {
      map.set(row.id, row.name as ServiceCategory);
    }
    return map;
  }

  /**
   * Uploads an image file to Supabase Storage and returns the public URL.
   */
  private async uploadImage(
    file: File
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    const supabase = await createClient();

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const filePath = `services/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('service-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return { success: false, error: `Image upload failed: ${uploadError.message}` };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('service-images').getPublicUrl(filePath);

    return { success: true, url: publicUrl };
  }
}

// ─── Export Helpers (for testing) ───────────────────────────────────────────

export {
  validateCreateInput,
  validateUpdateInput,
  validateName,
  validateDescription,
  validateDuration,
  validatePrice,
  validateCategory,
  VALID_CATEGORIES,
  CATEGORY_ORDER,
};
