import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { paymentService } from '@/lib/services/payment.service';

/**
 * Property 16: Simulated payment always succeeds
 *
 * For any input values provided to the simulated payment form (including empty strings,
 * null values, random strings, and special characters), the payment SHALL always return
 * success with a valid transaction ID.
 *
 * **Validates: Requirements 8.2**
 */
describe('Property 16: Simulated payment always succeeds', () => {
  it('should always return success with a valid transaction ID for arbitrary inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // arbitrary bookingId (including empty, special chars)
        fc.oneof(
          fc.double(), // normal doubles (includes negative, zero, huge, NaN, Infinity)
          fc.constant(0),
          fc.constant(-1),
          fc.constant(Number.MAX_SAFE_INTEGER),
          fc.constant(Number.MIN_SAFE_INTEGER),
          fc.constant(Number.POSITIVE_INFINITY),
          fc.constant(Number.NEGATIVE_INFINITY),
          fc.constant(Number.NaN)
        ),
        async (bookingId: string, amount: number) => {
          const result = await paymentService.processPayment(bookingId, amount);

          // Always returns success
          expect(result.success).toBe(true);

          // transactionId matches pattern PAY-XXXXXXXX (8 uppercase hex chars)
          expect(result.transactionId).toMatch(/^PAY-[0-9A-F]{8}$/);

          // processedAt is a valid Date
          expect(result.processedAt).toBeInstanceOf(Date);
          expect(Number.isNaN(result.processedAt.getTime())).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });
});
