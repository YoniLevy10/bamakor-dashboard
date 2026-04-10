# Phase 2: Quick Reference Guide

## At a Glance

This guide provides quick copy-paste patterns for common scenarios.

---

## 1. Validate API Request

**Pattern**: Check user input before processing

```typescript
import { RequestValidator, ValidationSchemas, ResponseBuilder } from '@/lib/api-validation';

const validator = new RequestValidator();
if (!validator.validate(body, ValidationSchemas.ticket.create)) {
  return NextResponse.json(
    ...ResponseBuilder.validationError(validator.getErrors(), requestId),
    { status: 400 }
  );
}
```

**Schemas Available**:
- `ValidationSchemas.ticket.create`
- `ValidationSchemas.ticket.update`
- `ValidationSchemas.project.create`
- `ValidationSchemas.client.create`

**Custom Schema**:
```typescript
const customSchema = {
  fieldName: { type: 'string', required: true, minLength: 5, maxLength: 100 },
  priority: { type: 'string', enum: ['HIGH', 'LOW'] },
};
validator.validate(body, customSchema);
```

---

## 2. Return JSON Response

**Pattern**: Standardized consistent responses

```typescript
import { ResponseBuilder } from '@/lib/api-validation';

// Success
return NextResponse.json(
  ResponseBuilder.success(data, requestId),
  { status: 200 }
);

// Error
return NextResponse.json(
  ...ResponseBuilder.error('Something went wrong', requestId),
  { status: 400 }
);

// Not Found
return NextResponse.json(
  ...ResponseBuilder.notFound('User', requestId),
  { status: 404 }
);

// Unauthorized
return NextResponse.json(
  ...ResponseBuilder.unauthorized(requestId),
  { status: 401 }
);

// Validation Error
return NextResponse.json(
  ...ResponseBuilder.validationError(errors, requestId),
  { status: 400 }
);
```

---

## 3. Check Rate Limiting

**Pattern**: Prevent abuse

```typescript
import { checkRateLimit, ResponseBuilder } from '@/lib/api-validation';

const rateLimitInfo = checkRateLimit(clientId, '/api/create-ticket');
if (rateLimitInfo.isLimited) {
  return NextResponse.json(
    ...ResponseBuilder.error('Rate limit exceeded', requestId),
    { status: 429 }
  );
}
```

---

## 4. Clean User Input

**Pattern**: Sanitize strings, IDs, and emails

```typescript
import { sanitizeString, sanitizeId, sanitizeEmail } from '@/lib/api-validation';

const title = sanitizeString(body.title); // Trim, max 2000 chars
const clientId = sanitizeId(body.clientId); // UUID validation
const email = sanitizeEmail(body.email); // Email format + lowercase
```

---

## 5. Database Operation with Retry

**Pattern**: Resilient database calls

```typescript
import { withDatabaseRetry } from '@/lib/retry-logic';

const result = await withDatabaseRetry(
  () => supabase.from('tickets').insert([data]).select().single(),
  'create-ticket',
  clientId
);
```

**What It Does**:
- Retries on transient failures (connection timeout, etc)
- Backoff: 200ms → 400ms → 800ms
- Logs each attempt
- Throws error on final failure

---

## 6. External API Call with Retry

**Pattern**: Call third-party APIs

```typescript
import { withExternalApiRetry } from '@/lib/retry-logic';

const result = await withExternalApiRetry(
  () => fetch('https://api.example.com/data'),
  'fetch-external-data',
  'ExternalAPI'
);
```

**What It Does**:
- More aggressive retry (5 attempts)
- Longer backoff: 300ms → 750ms → 1.875s → 4.6s → 30s
- Handles rate limiting (503, 429)
- Logs all attempts

---

## 7. Batch Operations with Retry

**Pattern**: Process multiple items

```typescript
import { withBatchRetry } from '@/lib/retry-logic';

const results = await withBatchRetry(
  ticketIds,
  (id, index) => updateTicket(id),
  'batch-update-tickets'
);

console.log(`Succeeded: ${results.succeededCount}/${results.totalCount}`);
if (results.errors.length > 0) {
  console.error('Failures:', results.errors);
}
```

---

## 8. Prevent Cascading Failures

**Pattern**: Circuit breaker for external services

```typescript
import { getOrCreateCircuitBreaker } from '@/lib/retry-logic';

const breaker = getOrCreateCircuitBreaker('external-service', {
  failureThreshold: 5,
  timeout: 60000,
});

try {
  const result = await breaker.execute(() => callExternalService());
} catch {
  if (breaker.getState() === 'OPEN') {
    // Use fallback/cache instead
  }
}
```

---

## 9. Log Information

**Pattern**: Debug and monitor

```typescript
import { getLogger } from '@/lib/logging';

const logger = getLogger();

logger.debug('TICKET_API', 'Creating ticket', { clientId, title });
logger.info('TICKET_API', 'Ticket created', { ticketId });
logger.warn('TICKET_API', 'Retry attempt 2/3', { error: 'timeout' });
logger.error('TICKET_API', 'Failed to create', error, { clientId });
logger.critical('SYSTEM', 'Database connection lost', criticalError);
```

---

## 10. Performance Monitoring

**Pattern**: Track operation speed

```typescript
import { PerformanceMonitor } from '@/lib/logging';

const monitor = new PerformanceMonitor('TICKET_API');

monitor.mark('database-query');
const data = await db.query();

monitor.mark('processing');
const result = process(data);

monitor.mark('response-ready');
const duration = monitor.end('create-ticket');
// Logs: "Operation completed: create-ticket (duration: 45ms, marks: {...})"
```

---

## 11. Audit Critical Operations

**Pattern**: Compliance trail

```typescript
import { getAuditLogger } from '@/lib/logging';

const audit = getAuditLogger();

// Create ticket
audit.logTicketCreated(clientId, ticketId, userId);

// Update ticket
audit.logTicketUpdated(
  clientId,
  ticketId,
  { status: { before: 'NEW', after: 'ASSIGNED' } },
  userId
);

// Assign worker
audit.logTicketAssigned(clientId, ticketId, workerId, userId);

// Failed operation
audit.logFailedOperation('CREATE', 'TICKET', ticketId, clientId, 'Invalid data', userId);
```

---

## 12. Error Handling with Logging

**Pattern**: Robust error handling

```typescript
import { getLogger, withErrorHandling } from '@/lib/logging';

const logger = getLogger();
logger.setRequestContext(requestId, { clientId });

try {
  const [result, error, statusCode] = await withErrorHandling(
    () => myAsyncOperation(),
    requestId
  );

  if (error) {
    logger.error('API', `Operation failed: ${error}`, null, { clientId });
    return NextResponse.json(
      ResponseBuilder.error(error, requestId),
      { status: statusCode }
    );
  }

  return NextResponse.json(ResponseBuilder.success(result, requestId));

} finally {
  logger.clearRequestContext(requestId);
}
```

---

## 13. Combined Pattern: Full Safety

**Pattern**: Use all utilities together

```typescript
import { checkRateLimit, parseRequest, ValidationSchemas, RequestValidator } from '@/lib/api-validation';
import { withDatabaseRetry } from '@/lib/retry-logic';
import { getLogger, getAuditLogger, PerformanceMonitor } from '@/lib/logging';

export async function POST(request: NextRequest) {
  // Parse
  const [body, requestId, clientId] = await parseRequest(request) || [];

  // Rate limit
  if (checkRateLimit(clientId, endpoint).isLimited) {
    return NextResponse.json(...ResponseBuilder.error('Rate limited', requestId), { status: 429 });
  }

  // Validate
  const validator = new RequestValidator();
  if (!validator.validate(body, schema)) {
    return NextResponse.json(...ResponseBuilder.validationError(validator.getErrors(), requestId));
  }

  // Setup monitoring
  const logger = getLogger();
  const audit = getAuditLogger();
  const monitor = new PerformanceMonitor('API');
  logger.setRequestContext(requestId, { clientId });

  try {
    // Execute with retry
    monitor.mark('db-start');
    const result = await withDatabaseRetry(() => dbOperation(body), 'operation', clientId);
    monitor.mark('db-end');
    monitor.end('operation');

    // Audit
    audit.logTicketCreated(clientId, result.id);

    // Response
    logger.info('API', 'Success', { resultId: result.id });
    return NextResponse.json(ResponseBuilder.success(result, requestId));

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('API', 'Failed', err, { clientId });
    audit.logFailedOperation('CREATE', 'RESOURCE', 'unknown', clientId, err.message);
    return NextResponse.json(...ResponseBuilder.serverError(requestId), { status: 500 });
  } finally {
    logger.clearRequestContext(requestId);
  }
}
```

---

## Quick Config Reference

### Rate Limiting
- Max requests: 100 per minute per client/endpoint
- To adjust: Edit `lib/api-validation.ts` constants

### Retry Configuration
- **Database**: 3 attempts, 200ms-10s backoff
- **External API**: 5 attempts, 300ms-30s backoff
- **Custom**: Pass `RetryConfig` to `withRetry()`

### Log Levels
- `DEBUG`: Development details
- `INFO`: General flow information
- `WARN`: Warning conditions
- `ERROR`: Errors
- `CRITICAL`: System critical

Set minimum level: `initializeLogger({ minLevel: 'WARN' })`

### Circuit Breaker
- **Default**: Opens after 5 failures, closes after 2 successes, timeout 60s
- **Customize**: Pass config to `getOrCreateCircuitBreaker()`

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Validation failed` | Request doesn't match schema | Check schema matches body |
| `Rate limit exceeded` | Too many requests | Wait or increase limit |
| `Circuit breaker OPEN` | External service failing | Use fallback, wait for timeout |
| `Database constraint error` | Data violates DB constraints | Review database rules |
| `Request ID undefined` | Missing parseRequest step | Call `parseRequest()` first |

---

## Environment Setup

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
LOGGING_ENDPOINT=https://your-logs.example.com
NODE_ENV=production
```

---

## Testing Checklist

- [ ] Test validation with invalid data
- [ ] Test rate limiting with rapid requests
- [ ] Test database retry with network interruption
- [ ] Test circuit breaker with failing service
- [ ] Test logging with different log levels
- [ ] Test audit trail for compliance
- [ ] Test batch operations with partial failures

---

## See Also

- [Full Implementation Guide](./PHASE2_IMPLEMENTATION.md)
- [Code Examples](./PHASE2_EXAMPLES.ts)
- [Database Constraints](./database-phase2-constraints.sql)
