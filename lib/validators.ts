/**
 * Centralized validation utilities for forms
 * Prevents duplicate validation logic across components
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate required field (not empty string or whitespace)
 */
export function validateRequired(value: string | null | undefined, fieldName: string): ValidationError | null {
  if (!value || value.trim() === '') {
    return { field: fieldName, message: `${fieldName} is required` };
  }
  return null;
}

/**
 * Validate minimum length
 */
export function validateMinLength(value: string | null | undefined, min: number, fieldName: string): ValidationError | null {
  if (!value || value.length < min) {
    return { field: fieldName, message: `${fieldName} must be at least ${min} characters` };
  }
  return null;
}

/**
 * Validate maximum length
 */
export function validateMaxLength(value: string | null | undefined, max: number, fieldName: string): ValidationError | null {
  if (value && value.length > max) {
    return { field: fieldName, message: `${fieldName} must not exceed ${max} characters` };
  }
  return null;
}

/**
 * Validate phone number format (basic: 10+ digits)
 */
export function validatePhoneNumber(value: string | null | undefined, fieldName: string = 'Phone'): ValidationError | null {
  if (!value) return null; // Allow empty if optional
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length < 10) {
    return { field: fieldName, message: `${fieldName} must contain at least 10 digits` };
  }
  return null;
}

/**
 * Validate email format
 */
export function validateEmail(value: string | null | undefined, fieldName: string = 'Email'): ValidationError | null {
  if (!value) return null; // Allow empty if optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return { field: fieldName, message: `${fieldName} is not a valid email` };
  }
  return null;
}

/**
 * Validate enum value
 */
export function validateEnum(value: string | null | undefined, validValues: string[], fieldName: string): ValidationError | null {
  if (!value || !validValues.includes(value)) {
    return { field: fieldName, message: `${fieldName} must be one of: ${validValues.join(', ')}` };
  }
  return null;
}

/**
 * Run multiple validations and return first error or null
 */
export function validateField(validators: (ValidationError | null)[]): ValidationError | null {
  for (const error of validators) {
    if (error) return error;
  }
  return null;
}

/**
 * Run all validations and return all errors
 */
export function validateAll(validators: (ValidationError | null)[]): ValidationError[] {
  return validators.filter((error): error is ValidationError => error !== null);
}
