import { NextRequest, NextResponse } from 'next/server';
import { ServiceCatalogService } from '@/lib/services/service-catalog.service';
import type { ServiceCategory } from '@/lib/types';

const serviceCatalog = new ServiceCatalogService();

/**
 * GET /api/services
 * Public endpoint — lists active services with pagination.
 * Query params: page (default 1), pageSize (default 20), grouped (optional, returns by category)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const grouped = searchParams.get('grouped');

    // If grouped=true, return services grouped by category (for customer browsing)
    if (grouped === 'true') {
      const servicesByCategory = await serviceCatalog.getServicesByCategory();

      // Convert Map to a serializable object
      const result: Record<string, ReturnType<typeof serializeService>[]> = {};
      for (const [category, services] of servicesByCategory) {
        result[category] = services.map(serializeService);
      }

      return NextResponse.json({ data: result });
    }

    // Default: paginated flat list
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10) || 20)
    );

    const result = await serviceCatalog.getAllServices({ page, pageSize });

    return NextResponse.json({
      data: result.data.map(serializeService),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error('GET /api/services error:', error);
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to retrieve services' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/services
 * Admin only — creates a new service.
 * Expects JSON body with: name, description, duration, price, category
 * Image upload handled separately (or via multipart form data).
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let name: string;
    let description: string;
    let duration: number;
    let price: number;
    let category: ServiceCategory;
    let imageFile: File | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      name = formData.get('name') as string;
      description = formData.get('description') as string;
      duration = parseInt(formData.get('duration') as string, 10);
      price = parseFloat(formData.get('price') as string);
      category = formData.get('category') as ServiceCategory;
      const file = formData.get('image') as File | null;
      if (file && file.size > 0) {
        imageFile = file;
      }
    } else {
      const body = await request.json();
      name = body.name;
      description = body.description;
      duration = body.duration;
      price = body.price;
      category = body.category;
    }

    const result = await serviceCatalog.createService({
      name,
      description,
      duration,
      price,
      category,
      imageFile,
    });

    if (!result.success) {
      if (result.fieldErrors) {
        return NextResponse.json(
          {
            error: {
              code: 'validation_error',
              message: result.error ?? 'Validation failed',
              details: result.fieldErrors,
            },
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: { code: 'create_failed', message: result.error ?? 'Failed to create service' } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: serializeService(result.service!) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/services error:', error);
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to create service' } },
      { status: 500 }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function serializeService(service: {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: service.id,
    tenantId: service.tenantId,
    name: service.name,
    description: service.description,
    duration: service.duration,
    price: service.price,
    category: service.category,
    imageUrl: service.imageUrl,
    isActive: service.isActive,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}
