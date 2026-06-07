import { describe, it, expect } from 'vitest';
import { paymentService } from './payment.service';

describe('PaymentService', () => {
  describe('processPayment', () => {
    it('should always return success: true', async () => {
      const result = await paymentService.processPayment('booking-123', 99.99);
      expect(result.success).toBe(true);
    });

    it('should return a transaction ID starting with PAY-', async () => {
      const result = await paymentService.processPayment('booking-123', 50);
      expect(result.transactionId).toMatch(/^PAY-[A-Z0-9]{8}$/);
    });

    it('should return a processedAt date', async () => {
      const before = new Date();
      const result = await paymentService.processPayment('booking-123', 50);
      const after = new Date();

      expect(result.processedAt).toBeInstanceOf(Date);
      expect(result.processedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.processedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should generate unique transaction IDs', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () => paymentService.processPayment('any', 0))
      );
      const ids = results.map((r) => r.transactionId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should succeed with zero amount', async () => {
      const result = await paymentService.processPayment('booking-1', 0);
      expect(result.success).toBe(true);
    });

    it('should succeed with negative amount', async () => {
      const result = await paymentService.processPayment('booking-1', -100);
      expect(result.success).toBe(true);
    });

    it('should succeed with empty bookingId', async () => {
      const result = await paymentService.processPayment('', 50);
      expect(result.success).toBe(true);
    });
  });
});
