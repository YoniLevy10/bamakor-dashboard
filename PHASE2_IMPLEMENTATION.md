# Phase 2: Data Safety Implementation Guide

## Overview

Phase 2 focuses on making the system more robust, safe, and maintainable through:
- **Database constraints** for data integrity
- **API validation** for request safety
- **Retry logic** for resilience
- **Logging & monitoring** for visibility

## Files Created

### 1. `database-phase2-constraints.sql`
**Purpose**: Database-level data integrity
**Content**:
- NOT NULL constraints on foreign keys
- ENUM/CHECK constraints for controlled values
- UNIQUE constraints to prevent duplicates
- Foreign key constraints for referential integrity
- Default values for common fields

**Usage**:
```sql
-- Apply to your Supabase database
-- In Supabase SQL Editor, copy and run the entire file
-- Or run individual ALTER TABLE statements as needed
```

**Safety Notes**:
- Constraints are additive; won't break existing valid data
- If existing data violates constraints, fix data first, then apply constraints
- Can be applied incrementally

---

### 2. `lib/api-validation.ts`
**Purpose**: Request validation, error handling, rate limiting

**Key Components**:

#### ValidationSchemas
Predefined schemas for common operations:
```typescript
// Example usage
import { ValidationSchemas, RequestValidator } from '@/lib/api-validation';

const validator = new RequestValidator();
if (!validator.validate(requestBody, ValidationSchemas.ticket.create)) {
  return handleValidationError(validator.getErrors());
}
```

#### ResponseBuilder
Standardized API responses:
```typescript
import { ResponseBuilder } from '@/lib/api-validation';

// Success
return NextResponse.json(ResponseBuilder.success(data, requestId));

// Error
return NextResponse.json(...ResponseBuilder.error('Failed', requestId));

// Validation error
return NextResponse.json(...ResponseBuilder.validationError(errors, requestId));
```

#### Rate Limiting
Prevents abuse:
```typescript
import { checkRateLimit } from '@/lib/api-validation';

const rateLimitInfo = checkRateLimit(clientId, endpoint);
if (rateLimitInfo.isLimited) {
  return NextResponse.json(...ResponseBuilder.error('Rate limited', requestId), { status: 429 });
}
```

#### Sanitization
Clean user input:
```typescript
import { sanitizeString, sanitizeId, sanitizeEmail } from '@/lib/api-validation';

const cleanTitle = sanitizeString(userData.title);
const cleanId = sanitizeId(userData.clientId);
const cleanEmail = sanitizeEmail(userData.email);
```

---

### 3. `lib/retry-logic.ts`
**Purpose**: Resilient operations with exponential backoff

**Key Components**:

#### withRetry
Basic retry wrapper:
```typescript
import { withRetry } from '@/lib/retry-logic';

const result = await withRetry(
  () => supabase.from('tickets').select().eq('client_id', clientId),
  'fetch-tickets',
  {
    maxAttempts: 3,
    initialDelayMs: 100,
    backoffMultiplier: 2,
  }
);
```

#### withDatabaseRetry
Database-specific retry:
```typescript
import { withDatabaseRetry } from '@/lib/retry-logic';

const result = await withDatabaseRetry(
  () => supabase.from('tickets').insert([ticketData]),
  'insert-ticket',
  clientId
);
```

#### withExternalApiRetry
API-specific retry with longer timeouts:
```typescript
import { withExternalApiRetry } from '@/lib/retry-logic';

const result = await withExternalApiRetry(
  () => fetch('https://api.example.com/...'),
  'fetch-external-data',
  'ExternalAPI'
);
```

#### withBatchRetry
Batch operations with retry:
```typescript
import { withBatchRetry } from '@/lib/retry-logic';

const results = await withBatchRetry(
  ticketIds,
  (id, index) => updateTicket(id),
  'batch-update-tickets'
);

console.log(`Succeeded: ${results.succeededCount}, Failed: ${results.failedCount}`);
```

#### CircuitBreaker
Prevent cascading failures:
```typescript
import { getOrCreateCircuitBreaker } from '@/lib/retry-logic';

const breaker = getOrCreateCircuitBreaker('external-api', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
});

try {
  const result = await breaker.execute(() => fetchExternalData());
} catch (error) {
  if (breaker.getState() === 'OPEN') {
    // Use cached data or fallback
  }
}
```

---

### 4. `lib/logging.ts`
**Purpose**: Structured logging and audit trails

**Key Components**:

#### Logger
Main logging class:
```typescript
import { initializeLogger, getLogger } from '@/lib/logging';

// Initialize (in app startup)
initializeLogger({
  minLevel: 'DEBUG',
  enableConsole: true,
  enableFile: true,
  enableRemote: process.env.NODE_ENV === 'production',
});

// Use
const logger = getLogger();
logger.info('TICKET_API', 'Ticket created', { ticketId, clientId });
logger.error('TICKET_API', 'Failed to create ticket', error, { clientId });
```

#### Log Levels
- **DEBUG**: Low-level details
- **INFO**: General information
- **WARN**: Warning conditions
- **ERROR**: Error conditions
- **CRITICAL**: System-critical errors

#### PerformanceMonitor
Track operation performance:
```typescript
import { PerformanceMonitor } from '@/lib/logging';

const monitor = new PerformanceMonitor('TICKET_API');

// ... do work ...
monitor.mark('database-query-complete');
// ... do more work ...
monitor.mark('response-prepared');

const duration = monitor.end('create-ticket');
```

#### AuditLogger
Audit trail for compliance:
```typescript
import { getAuditLogger } from '@/lib/logging';

const audit = getAuditLogger();

audit.logTicketCreated(clientId, ticketId, userId);
audit.logTicketUpdated(clientId, ticketId, { status: { before: 'NEW', after: 'ASSIGNED' } }, userId);
audit.logFailedOperation('CREATE', 'TICKET', ticketId, clientId, 'Invalid client', userId);
```

---

## Integration Guide

### Step 1: Update API Routes

Example: `app/api/create-ticket/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { parseRequest, ValidationSchemas, RequestValidator, ResponseBuilder, checkRateLimit } from '@/lib/api-validation';
import { withDatabaseRetry } from '@/lib/retry-logic';
import { getLogger, getAuditLogger } from '@/lib/logging';

export async function POST(request: NextRequest) {
  // Parse and validate request
  const parsed = await parseRequest(request);
  if (!parsed) {
    const requestId = 'unknown';
    return NextResponse.json(
      ...ResponseBuilder.error('Invalid request format', requestId)
    );
  }

  const [body, requestId, clientId] = parsed;

  // Rate limiting
  const rateLimitInfo = checkRateLimit(clientId, '/api/create-ticket');
  if (rateLimitInfo.isLimited) {
    return NextResponse.json(
      ...ResponseBuilder.error('Rate limit exceeded', requestId),
      { status: 429 }
    );
  }

  // Validation
  const validator = new RequestValidator();
  if (!validator.validate(body, ValidationSchemas.ticket.create)) {
    return NextResponse.json(
      ...ResponseBuilder.validationError(validator.getErrors(), requestId),
      { status: 400 }
    );
  }

  // Logging setup
  const logger = getLogger();
  const audit = getAuditLogger();

  logger.setRequestContext(requestId, { clientId });

  try {
    // Business logic with retry
    const result = await withDatabaseRetry(
      async () => {
        // Your database operation here
        return await createTicket(body);
      },
      'create-ticket',
      clientId
    );

    // Audit log
    audit.logTicketCreated(clientId, result.id);

    // Success response
    logger.info('TICKET_API', 'Ticket created successfully', { ticketId: result.id });
    return NextResponse.json(
      ResponseBuilder.success({ ticket: result }, requestId),
      { status: 201 }
    );

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    
    logger.error('TICKET_API', 'Failed to create ticket', err, { clientId });
    audit.logFailedOperation('CREATE', 'TICKET', 'unknown', clientId, err.message);

    return NextResponse.json(
      ...ResponseBuilder.error('Failed to create ticket', requestId),
      { status: 500 }
    );

  } finally {
    logger.clearRequestContext(requestId);
  }
}
```

### Step 2: Apply Database Constraints

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `database-phase2-constraints.sql`
3. Run the SQL
4. Verify all queries succeed

### Step 3: Update Environment Variables

```env
# .env.local
NODE_ENV=development
LOGGING_ENDPOINT=https://your-logging-service.com/logs
```

### Step 4: Test Each Component

#### Test Validation
```bash
curl -X POST http://localhost:3000/api/create-ticket \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: client-123" \
  -d '{"title":"Short"}'  # Should fail (title too short)
```

#### Test Retry Logic
```typescript
// In a test file
import { withRetry } from '@/lib/retry-logic';

let attempts = 0;
const result = await withRetry(
  () => {
    attempts++;
    if (attempts < 2) throw new Error('ECONNREFUSED');
    return { success: true };
  },
  'test-retry'
);
expect(attempts).toBe(2); // Should retry
```

#### Test Rate Limiting
```bash
# Make multiple requests quickly
for i in {1..150}; do
  curl -X POST http://localhost:3000/api/create-ticket \
    -H "Content-Type: application/json" \
    -H "X-Client-Id: client-123"
done
# After 100 requests, should get 429 Too Many Requests
```

#### Test Logging
```typescript
import { getLogger, initializeLogger } from '@/lib/logging';

initializeLogger({ minLevel: 'DEBUG' });
const logger = getLogger();

logger.info('TEST', 'Just testing', { value: 42 });
logger.warn('TEST', 'Something unusual');
logger.error('TEST', 'An error occurred', new Error('Test error'));
```

---

## Monitoring & Debugging

### Viewing Logs

```typescript
import { getLogger } from '@/lib/logging';

const logger = getLogger();
const stats = logger.getStatistics();
console.log(`Buffer size: ${stats.bufferSize}, Context size: ${stats.contextSize}`);
logger.flushBuffer(); // Force flush
```

### Circuit Breaker Status

```typescript
import { getOrCreateCircuitBreaker } from '@/lib/retry-logic';

const breaker = getOrCreateCircuitBreaker('external-api');
console.log('State:', breaker.getState()); // CLOSED, OPEN, or HALF_OPEN
```

### Performance Monitoring

```typescript
import { PerformanceMonitor } from '@/lib/logging';

const monitor = new PerformanceMonitor('OPERATION');
monitor.mark('checkpoint-1');
// ... do work ...
monitor.mark('checkpoint-2');
const duration = monitor.end('operation-name');
// Logs the duration and checkpoints
```

---

## Best Practices

### 1. Always Validate Input
```typescript
// ✅ Good
const validator = new RequestValidator();
if (!validator.validate(body, ValidationSchemas.ticket.create)) {
  return handleError(validator.getErrors());
}

// ❌ Bad - No validation
const ticket = await createTicket(body);
```

### 2. Use Appropriate Retry Strategies
```typescript
// ✅ Good - Database retry for transient failures
const result = await withDatabaseRetry(dbOperation, 'name', clientId);

// ❌ Bad - Retrying non-idempotent operations
await withRetry(logToThirdParty, 'log'); // No! Could log twice
```

### 3. Log Context
```typescript
// ✅ Good - Include relevant context
logger.info('TICKET_API', 'Processing ticket', { clientId, ticketId, operation: 'create' });

// ❌ Bad - No context
logger.info('TICKET_API', 'Processing');
```

### 4. Audit Critical Operations
```typescript
// ✅ Good - Audit trail for compliance
audit.logTicketUpdated(clientId, ticketId, changes, userId);

// ❌ Bad - No audit trail
updateTicket(ticketId, changes);
```

### 5. Clean Up Context
```typescript
// ✅ Good - Always clean up
try {
  // ... do work ...
} finally {
  logger.clearRequestContext(requestId);
}

// ❌ Bad - Context leak
logger.info('TICKET', 'Something', data);
// Context still in memory after request
```

---

## Deployment Checklist

- [ ] Review and apply `database-phase2-constraints.sql`
- [ ] Add validation to all API endpoints
- [ ] Implement retry logic for critical operations
- [ ] Initialize logger in app startup
- [ ] Set up audit logging for sensitive operations
- [ ] Configure rate limiting thresholds
- [ ] Set environment variables for remote logging (if applicable)
- [ ] Test all error scenarios
- [ ] Monitor logs in production
- [ ] Document custom validation schemas
- [ ] Configure alerts for CRITICAL logs

---

## Next Steps (Phase 3)

- Error recovery strategies
- Data migration utilities
- Automated testing for data safety
- Performance optimization
