/**
 * API Validation & Error Handling - Phase 2: Data Safety
 * Centralizes validation logic, error responses, and rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ValidationError[];
  timestamp: string;
  requestId: string;
}

export interface RateLimitInfo {
  clientId: string;
  endpoint: string;
  requestCount: number;
  resetTime: number;
  isLimited: boolean;
}

// ============================================================================
// 2. VALIDATION SCHEMAS
// ============================================================================

export const ValidationSchemas = {
  ticket: {
    create: {
      client_id: { type: 'string', required: true, pattern: /^[a-f0-9-]{36}$/ },
      project_id: { type: 'string', required: true, pattern: /^[a-f0-9-]{36}$/ },
      title: { type: 'string', required: true, minLength: 3, maxLength: 255 },
      description: { type: 'string', required: true, minLength: 10 },
      priority: { type: 'string', required: false, enum: ['HIGH', 'MEDIUM', 'LOW'] },
      assigned_to: { type: 'string', required: false, pattern: /^[a-f0-9-]{36}$|^null$/ },
      phone_number: { type: 'string', required: false, pattern: /^\+?[1-9]\d{1,14}$/ },
    },
    update: {
      status: { type: 'string', required: false, enum: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'CLOSED'] },
      assigned_to: { type: 'string', required: false, pattern: /^[a-f0-9-]{36}$|^null$/ },
      priority: { type: 'string', required: false, enum: ['HIGH', 'MEDIUM', 'LOW'] },
      notes: { type: 'string', required: false, maxLength: 2000 },
    },
  },
  project: {
    create: {
      client_id: { type: 'string', required: true, pattern: /^[a-f0-9-]{36}$/ },
      project_code: { type: 'string', required: true, minLength: 2, maxLength: 20, pattern: /^[A-Z0-9_]+$/ },
      name: { type: 'string', required: true, minLength: 3, maxLength: 100 },
      description: { type: 'string', required: false, maxLength: 500 },
    },
  },
  client: {
    create: {
      name: { type: 'string', required: true, minLength: 2, maxLength: 100 },
      email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      phone: { type: 'string', required: false, pattern: /^\+?[1-9]\d{1,14}$/ },
      country: { type: 'string', required: false, minLength: 2, maxLength: 2, pattern: /^[A-Z]{2}$/ },
    },
  },
};

// ============================================================================
// 3. VALIDATOR CLASS
// ============================================================================

export class RequestValidator {
  private errors: ValidationError[] = [];

  reset(): void {
    this.errors = [];
  }

  validate(data: unknown, schema: Record<string, any>): boolean {
    this.errors = [];

    if (typeof data !== 'object' || data === null) {
      this.errors.push({ field: '_root', message: 'Request body must be a JSON object' });
      return false;
    }

    const obj = data as Record<string, unknown>;

    for (const [field, rules] of Object.entries(schema)) {
      const value = obj[field];

      // Check required
      if (rules.required && (value === undefined || value === null || value === '')) {
        this.errors.push({ field, message: `${field} is required`, value });
        continue;
      }

      // If not required and missing, skip further validation
      if (!rules.required && (value === undefined || value === null)) {
        continue;
      }

      // Type check
      if (rules.type && typeof value !== rules.type) {
        this.errors.push({
          field,
          message: `${field} must be of type ${rules.type}`,
          value,
        });
        continue;
      }

      // Enum check
      if (rules.enum && !rules.enum.includes(value)) {
        this.errors.push({
          field,
          message: `${field} must be one of: ${rules.enum.join(', ')}`,
          value,
        });
        continue;
      }

      // Pattern check
      if (rules.pattern) {
        const pattern = new RegExp(rules.pattern);
        if (!pattern.test(String(value))) {
          this.errors.push({
            field,
            message: `${field} format is invalid`,
            value,
          });
          continue;
        }
      }

      // Length checks
      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          this.errors.push({
            field,
            message: `${field} must be at least ${rules.minLength} characters`,
            value,
          });
          continue;
        }

        if (rules.maxLength && value.length > rules.maxLength) {
          this.errors.push({
            field,
            message: `${field} must be at most ${rules.maxLength} characters`,
            value,
          });
          continue;
        }
      }
    }

    return this.errors.length === 0;
  }

  getErrors(): ValidationError[] {
    return this.errors;
  }
}

// ============================================================================
// 4. RESPONSE BUILDERS
// ============================================================================

export class ResponseBuilder {
  static success<T>(data: T, requestId: string): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      requestId,
    };
  }

  static error(message: string, requestId: string, statusCode = 400): [ApiResponse<null>, number] {
    return [
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        requestId,
      },
      statusCode,
    ];
  }

  static validationError(errors: ValidationError[], requestId: string): [ApiResponse<null>, number] {
    return [
      {
        success: false,
        error: 'Validation failed',
        errors,
        timestamp: new Date().toISOString(),
        requestId,
      },
      400,
    ];
  }

  static notFound(resource: string, requestId: string): [ApiResponse<null>, number] {
    return [
      {
        success: false,
        error: `${resource} not found`,
        timestamp: new Date().toISOString(),
        requestId,
      },
      404,
    ];
  }

  static unauthorized(requestId: string): [ApiResponse<null>, number] {
    return [
      {
        success: false,
        error: 'Unauthorized',
        timestamp: new Date().toISOString(),
        requestId,
      },
      401,
    ];
  }

  static serverError(requestId: string): [ApiResponse<null>, number] {
    return [
      {
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        requestId,
      },
      500,
    ];
  }
}

// ============================================================================
// 5. REQUEST UTILITIES
// ============================================================================

export async function parseRequest(request: NextRequest): Promise<[unknown, string, string] | null> {
  try {
    const requestId = generateRequestId();
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      return null;
    }

    const body = await request.json();
    const clientId = request.headers.get('x-client-id') || 'unknown';

    return [body, requestId, clientId];
  } catch {
    return null;
  }
}

export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// 6. RATE LIMITING
// ============================================================================

const rateLimitMap = new Map<string, RateLimitInfo>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Per minute

export function checkRateLimit(clientId: string, endpoint: string): RateLimitInfo {
  const key = `${clientId}:${endpoint}`;
  const now = Date.now();
  const existing = rateLimitMap.get(key);

  if (!existing || now > existing.resetTime) {
    const info: RateLimitInfo = {
      clientId,
      endpoint,
      requestCount: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
      isLimited: false,
    };
    rateLimitMap.set(key, info);
    return info;
  }

  existing.requestCount++;
  existing.isLimited = existing.requestCount > RATE_LIMIT_MAX_REQUESTS;

  return existing;
}

// ============================================================================
// 7. SAFE API RESPONSE WRAPPER
// ============================================================================

export async function withErrorHandling<T>(
  handler: () => Promise<T>,
  requestId: string,
): Promise<[T | null, string | null, number]> {
  try {
    const result = await handler();
    return [result, null, 200];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';

    if (message.includes('not found')) {
      return [null, message, 404];
    }

    if (message.includes('unauthorized') || message.includes('permission')) {
      return [null, message, 401];
    }

    if (message.includes('already exists') || message.includes('duplicate')) {
      return [null, message, 409];
    }

    console.error(`[${requestId}] Error:`, error);
    return [null, 'Internal server error', 500];
  }
}

// ============================================================================
// 8. SANITIZATION UTILITIES
// ============================================================================

export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, 2000);
}

export function sanitizeId(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  // UUID format validation
  if (!/^[a-f0-9-]{36}$/.test(input)) return null;
  return input;
}

export function sanitizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.toLowerCase().trim();
  if (!email.includes('@')) return null;
  return email.slice(0, 255);
}
