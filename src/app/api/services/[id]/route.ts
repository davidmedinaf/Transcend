import { NextRequest, NextResponse } from 'next/server';
import { ServiceCatalogService } from '@/lib/services/service-catalog.service';
import type { ServiceCategory } from '@/lib/types';

const serviceCatalog = new ServiceCatalogService();

/**
 * GET /api/services/[id]
 * Public endpoint — retrieves a single service by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { error: { code: 'invalid_id', message: 'Invalid service ID format' } },
        { status: 400 }
      );
    }

    const service = await serviceCatalog.getServiceById(id);

    if (!service) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Service not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: serializeService(service) });
  } catch (error) {
    console.error('GET /api/services/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to retrieve service' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/services/[id]
 * Admin only — updates a service's details.
 * Expects JSON body with any combination of: name, description, duration, price, category
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { error: { code: 'invalid_id', message: 'Invalid service ID format' } },
        { status: 400 }
      );
    }

    const contentType = request.headers.get('content-type') ?? '';
    let name: string | undefined;
    let description: string | undefined;
    let duration: number | undefined;
    let price: number | undefined;
    let category: ServiceCategory | undefined;
    let imageFile: File | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const nameVal = formData.get('name') as string | null;
      const descVal = formData.get('description') as string | null;
      const durVal = formData.get('duration') as string | null;
      const priceVal = formData.get('price') as string | null;
      const catVal = formData.get('category') as string | null;
      const file = formData.get('image') as File | null;

      if (nameVal !== null) name = nameVal;
      if (descVal !== null) description = descVal;
      if (durVal !== null) duration = parseInt(durVal, 10);
      if (priceVal !== null) price = parseFloat(priceVal);
      if (catVal !== null) category = catVal as ServiceCategory;
      if (file && file.size > 0) imageFile = file;
    } else {
      const body = await request.json();
      name = body.name;
      description = body.description;
      duration = body.duration;
      price = body.price;
      category = body.category;
    }

    const result = await serviceCatalog.updateService(id, {
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

      // Service not found
      if (result.error === 'Service not found') {
        return NextResponse.json(
          { error: { code: 'not_found', message: 'Service not found' } },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: { code: 'update_failed', message: result.error ?? 'Failed to update service' } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: serializeService(result.service!) });
  } catch (error) {
    console.error('PUT /api/services/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to update service' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/services/[id]
 * Admin only — deletes (deactivates) a service.
 * Rejects deletion if the service has confirmed future bookings.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { error: { code: 'invalid_id', message: 'Invalid service ID format' } },
        { status: 400 }
      );
    }

    const result = await serviceCatalog.deleteService(id);

    if (!result.success) {
      // Future bookings guard
      if (result.error?.includes('active future bookings')) {
        return NextResponse.json(
          { error: { code: 'has_bookings', message: result.error } },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: { code: 'delete_failed', message: result.error ?? 'Failed to delete service' } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('DELETE /api/services/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to delete service' } },
      { status: 500 }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

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
