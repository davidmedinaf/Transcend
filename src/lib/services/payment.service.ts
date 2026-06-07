import { PaymentResult } from '@/lib/types';

/**
 * Simulated Payment Service
 *
 * This is a mock payment service for the POC that always returns success.
 * In production, this interface would be swapped with a real Stripe implementation.
 */
export interface IPaymentService {
  processPayment(bookingId: string, amount: number): Promise<PaymentResult>;
}

/**
 * Generates a unique transaction ID in the format PAY-XXXXXXXX
 */
function generateTransactionId(): string {
  const chars = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
  return `PAY-${chars}`;
}

export const paymentService: IPaymentService = {
  /**
   * Process a simulated payment. Always succeeds regardless of input values.
   *
   * @param bookingId - The booking ID associated with this payment
   * @param amount - The payment amount in EUR
   * @returns PaymentResult with success: true and a generated transaction ID
   */
  async processPayment(_bookingId: string, _amount: number): Promise<PaymentResult> {
    return {
      success: true,
      transactionId: generateTransactionId(),
      processedAt: new Date(),
    };
  },
};
