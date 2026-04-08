/**
 * Centralized API error handling utilities
 * Ensures consistent error responses across all API routes
 */

import { NextResponse } from 'next/server'

export interface ApiErrorResponse {
  error: string
  code?: string
  details?: string
  timestamp?: string
}

export interface ApiSuccessResponse<T = any> {
  success: true
  data?: T
  [key: string]: any
}

/**
 * HTTP Status codes with semantic meanings
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

/**
 * Error codes for client handling
 */
export const ERROR_CODES = {
  // Validation
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // Resource
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Environment
  CONFIG_ERROR: 'CONFIG_ERROR',
  MISSING_ENV: 'MISSING_ENV',

  // Database
  DB_ERROR: 'DB_ERROR',
  DB_CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',

  // External
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

/**
 * Create error response with consistent structure
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  code: string = ERROR_CODES.INTERNAL_ERROR,
  details?: string
): { response: NextResponse; statusCode: number } {
  const isDevelopment = process.env.NODE_ENV === 'development'

  const errorResponse: ApiErrorResponse = {
    error: message,
    code,
    timestamp: new Date().toISOString(),
  }

  // Only include details in development
  if (isDevelopment && details) {
    errorResponse.details = details
  }

  return {
    response: NextResponse.json(errorResponse, { status: statusCode }),
    statusCode,
  }
}

/**
 * Create success response with consistent structure
 */
export function createSuccessResponse<T extends Record<string, any>>(
  data: T,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status: statusCode })
}

/**
 * Handle database errors with context
 */
export function handleDatabaseError(
  error: any,
  operation: string,
  context?: Record<string, any>
): { response: NextResponse; statusCode: number } {
  const isDevelopment = process.env.NODE_ENV === 'development'

  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR
  let code: string = ERROR_CODES.DB_ERROR
  let message = `Database error during ${operation}`
  let details: string | undefined

  // Check for specific error types
  const errorMsg = String(error?.message || error).toLowerCase()

  if (errorMsg.includes('unique') || errorMsg.includes('duplicate')) {
    statusCode = HTTP_STATUS.CONFLICT
    code = ERROR_CODES.ALREADY_EXISTS
    message = 'Record already exists'
  } else if (errorMsg.includes('foreign key') || errorMsg.includes('constraint')) {
    statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY
    code = ERROR_CODES.DB_CONSTRAINT_VIOLATION
    message = 'Database constraint violation'
  } else if (errorMsg.includes('not found')) {
    statusCode = HTTP_STATUS.NOT_FOUND
    code = ERROR_CODES.NOT_FOUND
    message = 'Record not found'
  }

  if (isDevelopment) {
    details = `Operation: ${operation}\nError: ${String(error)}`
    if (context) {
      details += `\nContext: ${JSON.stringify(context)}`
    }
  }

  console.error(`❌ Database error (${operation}):`, error)
  if (context) {
    console.error('Context:', context)
  }

  return createErrorResponse(message, statusCode, code, details)
}

/**
 * Handle external service errors (WhatsApp, etc.)
 */
export function handleExternalServiceError(
  error: any,
  service: string,
  operation: string,
  context?: Record<string, any>
): { response: NextResponse; statusCode: number } {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE
  const code = ERROR_CODES.EXTERNAL_SERVICE_ERROR

  let details: string | undefined
  if (isDevelopment) {
    details = `Service: ${service}\nOperation: ${operation}\nError: ${String(error)}`
    if (context) {
      details += `\nContext: ${JSON.stringify(context)}`
    }
  }

  console.error(`❌ ${service} error (${operation}):`, error)
  if (context) {
    console.error('Context:', context)
  }

  return createErrorResponse(
    `${service} service temporarily unavailable`,
    statusCode,
    code,
    details
  )
}

/**
 * Handle environment/configuration errors
 */
export function handleConfigError(
  missingVars: string[],
  context?: string
): { response: NextResponse; statusCode: number } {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR
  const code = ERROR_CODES.MISSING_ENV

  const message = 'Server configuration error. Required environment variables are not set.'

  let details: string | undefined
  if (isDevelopment) {
    details = `Missing: ${missingVars.join(', ')}`
    if (context) {
      details += `\nContext: ${context}`
    }
  }

  console.error('❌ Configuration error - Missing env vars:', missingVars)

  return createErrorResponse(message, statusCode, code, details)
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): { valid: boolean; missingFields: string[] } {
  const missingFields = requiredFields.filter((field) => !data[field])

  return {
    valid: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Wrap async route handler with error handling
 */
export function withErrorHandling(handler: (req: Request) => Promise<NextResponse>) {
  return async (req: Request) => {
    try {
      return await handler(req)
    } catch (error) {
      console.error('❌ Unhandled route error:', error)

      const isDevelopment = process.env.NODE_ENV === 'development'
      const response: ApiErrorResponse = {
        error: 'Internal server error',
        code: ERROR_CODES.INTERNAL_ERROR,
        timestamp: new Date().toISOString(),
      }

      if (isDevelopment) {
        response.details = String(error)
      }

      return NextResponse.json(response, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR })
    }
  }
}
