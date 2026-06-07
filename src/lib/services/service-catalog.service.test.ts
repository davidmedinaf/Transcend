import { describe, it, expect } from 'vitest';
import {
  validateCreateInput,
  validateUpdateInput,
  validateName,
  validateDescription,
  validateDuration,
  validatePrice,
  validateCategory,
  VALID_CATEGORIES,
} from './service-catalog.service';
import type { CreateServiceInput, UpdateServiceInput } from '@/lib/types';

describe('ServiceCatalogService - Validation', () => {
  describe('validateName', () => {
    it('returns error when required and undefined', () => {
      expect(validateName(undefined, true)).toBe('Name is required');
    });

    it('returns null when not required and undefined', () => {
      expect(validateName(undefined, false)).toBeNull();
    });

    it('returns error when empty string', () => {
      expect(validateName('', true)).toBe('Name must be at least 1 character');
    });

    it('returns null for valid name', () => {
      expect(validateName('Sports Massage', true)).toBeNull();
    });

    it('returns error when name exceeds 100 characters', () => {
      const longName = 'a'.repeat(101);
      expect(validateName(longName, true)).toBe('Name must be at most 100 characters');
    });

    it('accepts name with exactly 100 characters', () => {
      const maxName = 'a'.repeat(100);
      expect(validateName(maxName, true)).toBeNull();
    });

    it('accepts name with exactly 1 character', () => {
      expect(validateName('A', true)).toBeNull();
    });
  });

  describe('validateDescription', () => {
    it('returns error when required and undefined', () => {
      expect(validateDescription(undefined, true)).toBe('Description is required');
    });

    it('returns null when not required and undefined', () => {
      expect(validateDescription(undefined, false)).toBeNull();
    });

    it('returns error when empty string', () => {
      expect(validateDescription('', true)).toBe(
        'Description must be at least 1 character'
      );
    });

    it('returns null for valid description', () => {
      expect(validateDescription('A relaxing experience', true)).toBeNull();
    });

    it('returns error when description exceeds 500 characters', () => {
      const longDesc = 'a'.repeat(501);
      expect(validateDescription(longDesc, true)).toBe(
        'Description must be at most 500 characters'
      );
    });

    it('accepts description with exactly 500 characters', () => {
      const maxDesc = 'a'.repeat(500);
      expect(validateDescription(maxDesc, true)).toBeNull();
    });
  });

  describe('validateDuration', () => {
    it('returns error when required and undefined', () => {
      expect(validateDuration(undefined, true)).toBe('Duration is required');
    });

    it('returns null when not required and undefined', () => {
      expect(validateDuration(undefined, false)).toBeNull();
    });

    it('returns error for non-integer', () => {
      expect(validateDuration(30.5, true)).toBe('Duration must be an integer');
    });

    it('returns error for 0', () => {
      expect(validateDuration(0, true)).toBe('Duration must be at least 1 minute');
    });

    it('returns error for negative', () => {
      expect(validateDuration(-10, true)).toBe('Duration must be at least 1 minute');
    });

    it('returns error for exceeding 480', () => {
      expect(validateDuration(481, true)).toBe('Duration must be at most 480 minutes');
    });

    it('accepts 1 minute', () => {
      expect(validateDuration(1, true)).toBeNull();
    });

    it('accepts 480 minutes', () => {
      expect(validateDuration(480, true)).toBeNull();
    });

    it('accepts typical duration 60', () => {
      expect(validateDuration(60, true)).toBeNull();
    });
  });

  describe('validatePrice', () => {
    it('returns error when required and undefined', () => {
      expect(validatePrice(undefined, true)).toBe('Price is required');
    });

    it('returns null when not required and undefined', () => {
      expect(validatePrice(undefined, false)).toBeNull();
    });

    it('returns error for negative price', () => {
      expect(validatePrice(-1, true)).toBe('Price must be at least 0.00');
    });

    it('returns error for price exceeding 9999.99', () => {
      expect(validatePrice(10000, true)).toBe('Price must be at most 9999.99');
    });

    it('returns error for more than 2 decimal places', () => {
      expect(validatePrice(29.999, true)).toBe(
        'Price must have at most 2 decimal places'
      );
    });

    it('accepts 0.00', () => {
      expect(validatePrice(0, true)).toBeNull();
    });

    it('accepts 9999.99', () => {
      expect(validatePrice(9999.99, true)).toBeNull();
    });

    it('accepts price with 1 decimal place', () => {
      expect(validatePrice(49.5, true)).toBeNull();
    });

    it('accepts price with 2 decimal places', () => {
      expect(validatePrice(49.95, true)).toBeNull();
    });

    it('accepts integer price', () => {
      expect(validatePrice(100, true)).toBeNull();
    });
  });

  describe('validateCategory', () => {
    it('returns error when required and undefined', () => {
      expect(validateCategory(undefined, true)).toBe('Category is required');
    });

    it('returns null when not required and undefined', () => {
      expect(validateCategory(undefined, false)).toBeNull();
    });

    it('returns error for invalid category', () => {
      expect(validateCategory('InvalidCat' as any, true)).toBe(
        `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
      );
    });

    it('accepts Recovery', () => {
      expect(validateCategory('Recovery', true)).toBeNull();
    });

    it('accepts Treatments', () => {
      expect(validateCategory('Treatments', true)).toBeNull();
    });

    it('accepts Coaching', () => {
      expect(validateCategory('Coaching', true)).toBeNull();
    });

    it('accepts Events', () => {
      expect(validateCategory('Events', true)).toBeNull();
    });
  });

  describe('validateCreateInput', () => {
    const validInput: CreateServiceInput = {
      name: 'Sports Massage',
      description: 'A relaxing sports massage session.',
      duration: 60,
      price: 79.99,
      category: 'Treatments',
    };

    it('returns null for valid input', () => {
      expect(validateCreateInput(validInput)).toBeNull();
    });

    it('returns field errors for multiple invalid fields', () => {
      const invalidInput: CreateServiceInput = {
        name: '',
        description: '',
        duration: 0,
        price: -1,
        category: 'Invalid' as any,
      };
      const errors = validateCreateInput(invalidInput);
      expect(errors).not.toBeNull();
      expect(errors!.name).toBeDefined();
      expect(errors!.description).toBeDefined();
      expect(errors!.duration).toBeDefined();
      expect(errors!.price).toBeDefined();
      expect(errors!.category).toBeDefined();
    });

    it('returns error only for the invalid field', () => {
      const almostValid: CreateServiceInput = {
        ...validInput,
        duration: 500,
      };
      const errors = validateCreateInput(almostValid);
      expect(errors).not.toBeNull();
      expect(errors!.duration).toBeDefined();
      expect(errors!.name).toBeUndefined();
    });
  });

  describe('validateUpdateInput', () => {
    it('returns null for empty update (no fields provided)', () => {
      expect(validateUpdateInput({})).toBeNull();
    });

    it('returns null for valid partial update', () => {
      const input: UpdateServiceInput = { name: 'New Name', price: 50 };
      expect(validateUpdateInput(input)).toBeNull();
    });

    it('returns errors for invalid partial update', () => {
      const input: UpdateServiceInput = { name: '', duration: 0 };
      const errors = validateUpdateInput(input);
      expect(errors).not.toBeNull();
      expect(errors!.name).toBeDefined();
      expect(errors!.duration).toBeDefined();
    });
  });
});
