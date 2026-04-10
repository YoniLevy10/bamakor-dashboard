# Phase 2 Deployment Guide

## Pre-Deployment Checklist

Before deploying Phase 2 to production, complete these tasks:

- [ ] Code reviewed and tested in development
- [ ] Database constraints validated (not breaking existing data)
- [ ] All API routes updated with validation
- [ ] Error handling tested with edge cases
- [ ] Retry logic tested with network interruptions
- [ ] Logging configured for production
- [ ] Rate limiting thresholds appropriate
- [ ] Audit logging enabled
- [ ] Monitoring alerts configured
- [ ] Team trained on new error responses
- [ ] Rollback plan documented
- [ ] Backup created

---

## Phase 2 Deployment Process

### Stage 1: Preparation (Development)

#### 1.1 Create Feature Branch
```bash
git checkout -b phase2/data-safety
git pull origin main
```

#### 1.2 Copy Phase 2 Files
Ensure these files are in your workspace:
- `lib/api-validation.ts`
- `lib/retry-logic.ts`
- `lib/logging.ts`
- `database-phase2-constraints.sql`
- `PHASE2_IMPLEMENTATION.md`
- `PHASE2_QUICK_REFERENCE.md`
- `PHASE2_EXAMPLES.ts`

#### 1.3 Install Dependencies
All Phase 2 utilities use only Node.js built-ins and existing dependencies.
```bash
npm install --no-new-packages # Verify no new deps needed
```

#### 1.4 Build Test
```bash
npm run build
# Should compile without errors
```

#### 1.5 Commit Phase 2 Utilities
```bash
git add lib/api-validation.ts lib/retry-logic.ts lib/logging.ts
git add *.md  # Documentation
git commit -m "feat: Phase 2 data safety utilities

- Add request validation with schemas
- Add exponential backoff retry logic
- Add structured logging with audit trail
- Add circuit breaker pattern
"
```

---

### Stage 2: API Integration (Development)

#### 2.1 Update One API Route (Test Case)

Pick the simplest route first (e.g., `app/api/create-ticket/route.ts`):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  parseRequest,
  ValidationSchemas,
  RequestValidator,
  ResponseBuilder,
  checkRateLimit,
} from '@/lib/api-validation';
import { withDatabaseRetry } from '@/lib/retry-logic';
import { getLogger, getAuditLogger } from '@/lib/logging';

export async function POST(request: NextRequest) {
  // 1. Parse and validate format
  const parsed = await parseRequest(request);
  if (!parsed) {
    return NextResponse.json(
      ...ResponseBuilder.error('Invalid request format', 'UNKNOWN'),
      { status: 400 }
    );
  }

  const [body, requestId, clientId] = parsed;

  // 2. Check rate limit
  const rateLimit = checkRateLimit(clientId, '/api/create-ticket');
  if (rateLimit.isLimited) {
    return NextResponse.json(
      ...ResponseBuilder.error('Rate limited', requestId),
      { status: 429 }
    );
  }

  // 3. Validate request body
  const validator = new RequestValidator();
  if (!validator.validate(body, ValidationSchemas.ticket.create)) {
    return NextResponse.json(
      ...ResponseBuilder.validationError(validator.getErrors(), requestId),
      { status: 400 }
    );
  }

  // 4. Setup logging
  const logger = getLogger();
  const audit = getAuditLogger();
  logger.setRequestContext(requestId, { clientId });

  try {
    // 5. Execute with retry
    const ticket = await withDatabaseRetry(
      async () => {
        const { data, error } = await supabase
          .from('tickets')
          .insert([{
            client_id: clientId,
            project_id: body.project_id,
            title: body.title,
            description: body.description,
            priority: body.priority || 'MEDIUM',
            status: 'NEW',
          }])
          .select()
          .single();

        if (error) throw new Error(error.message);
        return data;
      },
      'create-ticket',
      clientId
    );

    // 6. Audit trail
    audit.logTicketCreated(clientId, ticket.id);

    // 7. Logging
    logger.info('TICKET_API', 'Ticket created', { ticketId: ticket.id });

    // 8. Response
    return NextResponse.json(
      ResponseBuilder.success({ ticket }, requestId),
      { status: 201 }
    );

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('TICKET_API', 'Failed to create ticket', err, { clientId });
    audit.logFailedOperation('CREATE', 'TICKET', 'unknown', clientId, err.message);

    return NextResponse.json(
      ...ResponseBuilder.serverError(requestId),
      { status: 500 }
    );

  } finally {
    logger.clearRequestContext(requestId);
  }
}
```

#### 2.2 Test the Updated Route

```bash
# Test validation error
curl -X POST http://localhost:3000/api/create-ticket \
  -H "Content-Type: application/json" \
  -d '{"title":"x"}' \
  # Should return 400 with validation errors

# Test success
curl -X POST http://localhost:3000/api/create-ticket \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client" \
  -d '{
    "client_id": "123e4567-e89b-12d3-a456-426614174000",
    "project_id": "223e4567-e89b-12d3-a456-426614174000",
    "title": "Test Ticket",
    "description": "This is a test ticket with sufficient description"
  }' \
  # Should return 201 with ticket data
```

#### 2.3 Commit Integration
```bash
git add app/api/create-ticket/route.ts
git commit -m "refactor: Add Phase 2 safety to create-ticket endpoint

- Add request validation with ValidationSchemas
- Add rate limiting checks
- Add database retry with exponential backoff
- Add structured logging and audit trail
"
```

#### 2.4 Update Remaining API Routes

Repeat Step 2.1-2.3 for:
- `app/api/update-ticket/route.ts`
- `app/api/assign-ticket/route.ts`
- `app/api/close-ticket/route.ts`
- Other critical endpoints

---

### Stage 3: Database Constraints (Staging)

#### 3.1 Review Current Data
```sql
-- In Supabase SQL Editor
-- Check for NULL client_ids
SELECT COUNT(*) FROM tickets WHERE client_id IS NULL;
SELECT COUNT(*) FROM projects WHERE client_id IS NULL;

-- Check for invalid statuses
SELECT DISTINCT status FROM tickets;
-- Should only show: NEW, ASSIGNED, IN_PROGRESS, WAITING_PARTS, CLOSED

-- Check for duplicate ticket numbers per client
SELECT client_id, ticket_number, COUNT(*) 
FROM tickets 
GROUP BY client_id, ticket_number 
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

#### 3.2 Fix Any Data Issues
```sql
-- Example: Set orphaned tickets to a valid client
UPDATE tickets 
SET client_id = (SELECT id FROM clients LIMIT 1) 
WHERE client_id IS NULL;

-- Example: Fix invalid statuses
UPDATE tickets 
SET status = 'NEW' 
WHERE status NOT IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'CLOSED');
```

#### 3.3 Apply Constraints to Staging

**IMPORTANT**: Test on staging database first!

1. Go to Supabase → SQL Editor
2. Copy entire `database-phase2-constraints.sql` file
3. Run the SQL
4. Verify: All statements should execute without error
5. Test: Try inserting invalid data, should fail

```sql
-- This should fail (violates constraint)
INSERT INTO tickets (client_id) VALUES (NULL);
-- Error: new row for relation "tickets" violates check constraint "tickets_client_id_not_null"
```

#### 3.4 Test Constraint Violations

```sql
-- These should all fail:

-- 1. NEW ticket with NULL client
INSERT INTO tickets (ticket_number, client_id, project_id, status) 
VALUES ('T001', NULL, 'proj-id', 'NEW');
-- Error: NOT NULL constraint

-- 2. Duplicate ticket number for same client
INSERT INTO tickets (ticket_number, client_id, project_id, status) 
VALUES ('T001', 'client-1', 'proj-1', 'NEW');
-- Error: UNIQUE constraint (if T001 exists for client-1)

-- 3. Invalid status
INSERT INTO tickets (ticket_number, client_id, project_id, status) 
VALUES ('T999', 'client-1', 'proj-1', 'INVALID');
-- Error: CHECK constraint

-- All should succeed:
-- Valid new ticket
INSERT INTO tickets (ticket_number, client_id, project_id, status) 
VALUES ('T999', 'client-1', 'proj-1', 'NEW');
```

#### 3.5 Commit Constraints
```bash
git add database-phase2-constraints.sql
git commit -m "feat: Add database constraints for data integrity

- Add NOT NULL constraints on foreign keys
- Add ENUM constraints on status/priority/roles
- Add UNIQUE constraints to prevent duplicates
- Add foreign key constraints for referential integrity
"
```

---

### Stage 4: Logger Initialization (Staging)

#### 4.1 Update App Layout
```typescript
// app/layout.tsx
import { initializeLogger } from '@/lib/logging';

// Initialize logger on app startup
initializeLogger({
  minLevel: process.env.NODE_ENV === 'production' ? 'WARN' : 'DEBUG',
  enableConsole: true,
  enableFile: true,
  enableRemote: process.env.NODE_ENV === 'production',
  defaultCategory: 'APP',
});

// ... rest of layout
```

#### 4.2 Test Logger
```typescript
// Add temporary test in a route
import { getLogger } from '@/lib/logging';

export async function GET() {
  const logger = getLogger();
  logger.info('TEST', 'Logger initialized', { env: process.env.NODE_ENV });
  
  return Response.json({ success: true });
}
```

#### 4.3 Verify Logs
```bash
# Make request
curl http://localhost:3000/api/test

# Check console output
# You should see: [timestamp] [INFO] [TEST] Logger initialized...
```

---

### Stage 5: Environment Configuration (Production)

#### 5.1 Add Production Environment Variables

```env
# .env.production
NODE_ENV=production
LOGGING_ENDPOINT=https://your-logging-service/logs
LOG_LEVEL=WARN
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

#### 5.2 Verify Secrets
```bash
# Ensure all required secrets are set in production
# In Vercel/deployment platform:
- NEXT_PUBLIC_SUPABASE_URL ✓
- SUPABASE_SERVICE_ROLE_KEY ✓
- SUPABASE_ANON_KEY ✓
- LOGGING_ENDPOINT (new)
```

---

### Stage 6: Production Deployment

#### 6.1 Create Production Branch
```bash
git checkout -b release/phase2-data-safety
git merge phase2/data-safety
# Verify: all Phase 2 changes are included
```

#### 6.2 Pre-Production Testing

Create a staging deployment:
```bash
# Deploy to staging environment
npm run build && npm run start
# or: vercel deploy --prod --name=staging
```

Verify in staging:
```bash
# 1. Test validation
curl -X POST https://staging.example.com/api/create-ticket \
  -H "Content-Type: application/json" \
  -d '{}'

# 2. Test rate limiting (101 rapid requests)
for i in {1..101}; do curl https://staging.example.com/api/create-ticket & done

# 3. Test success with valid data
curl -X POST https://staging.example.com/api/create-ticket \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client" \
  -d '{...valid data...}'

# 4. Check logs appear properly
curl https://staging.example.com/api/health
# Should show logger stats
```

#### 6.3 Production Deployment

Deploy to production:
```bash
git push origin release/phase2-data-safety
# Trigger production deployment (automated or manual)
```

Monitor after deployment:
```bash
# Watch logs in real-time
tail -f logs/production.log | grep "CRITICAL\|ERROR"

# Check error rates
curl https://example.com/api/health
# Monitor for increased error rate

# Test key endpoint
curl -X POST https://example.com/api/create-ticket \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: prod-client" \
  -d '{...test data...}'
```

#### 6.4 Post-Deployment

1. **Monitor Error Rates**
   - First hour: Watch for spikes
   - First day: Compare to baseline
   - Alert if >5% error rate

2. **Check Logs**
   - Search for CRITICAL errors
   - Review failed validations
   - Monitor retry patterns

3. **Verify Audit Trail**
   - Spot-check audit logs
   - Verify timestamps and user IDs
   - Confirm action tracking

4. **Test Common Flows**
   - Create ticket
   - Update ticket
   - Assign ticket
   - Close ticket

5. **User Communication**
   - Inform team of changes
   - Share new error response formats
   - Explain rate limiting

---

## Rollback Plan

If critical issues occur:

### Quick Rollback (5 minutes)
```bash
# Revert to previous version
vercel rollback  # or
git revert <commit-hash> && git push
```

### Full Rollback (30 minutes)
```bash
# 1. Disable new validation in API routes
#    (comment out validation checks)
# 2. Remove Phase 2 constraint trigger
#    (ALTER TABLE ... DROP CONSTRAINT)
# 3. Restart services
# 4. Alert team
```

### Partial Rollback (Phase 2 without Constraints)
```sql
-- Keep API validation but remove DB constraints
ALTER TABLE tickets DROP CONSTRAINT tickets_client_id_not_null;
-- Keep retrying and logging
-- Continue with safer deployment
```

---

## Monitoring & Alerts

### Set Up Alerts

#### 1. Error Rate Alert
```
If: Error rate > 5% for 5 minutes
Then: Alert #ops channel
```

#### 2. Validation Failure Alert
```
If: Validation errors > 10% of requests for 10 minutes
Then: Alert #ops, review client integrations
```

#### 3. Circuit Breaker Alert
```
If: Any circuit breaker OPEN for > 1 hour
Then: Alert, check external service health
```

#### 4. Retry Exhaustion Alert
```
If: Retry failures > 1% for 30 minutes
Then: Alert, check database connection
```

### Monitor Metrics

```bash
# Query logs for metrics (if using logging service)
logs | grep "TICKET_API" 
  | stats count as total
  | stats sum(case when success=true then 1 else 0 end) as succeeded
  | eval success_rate = succeeded/total
  | where success_rate < 0.95

# Monitor by endpoint
logs | stats count by endpoint | sort - count
```

---

## Deployment Checklist

### Before Deployment
- [ ] Code review approved
- [ ] All tests passing
- [ ] No breaking changes in API responses
- [ ] Database constraints tested on staging
- [ ] Logger configured for production
- [ ] Rate limits appropriate for traffic
- [ ] Backup created
- [ ] Team notified

### During Deployment
- [ ] Blue-green deployment (no downtime)
- [ ] Health check passing
- [ ] Logs flowing to monitoring
- [ ] Team on standby

### After Deployment
- [ ] Error rate normal (<1%)
- [ ] No spike in validation failures
- [ ] Audit logs creating entries
- [ ] Retry patterns sensible
- [ ] Circuit breakers all CLOSED
- [ ] Team confirms functionality
- [ ] Document any issues

---

## Troubleshooting

### Issue: "Constraint violation" errors

**Cause**: Existing data violates new constraints

**Solution**:
```sql
-- Find problematic data
SELECT * FROM tickets WHERE client_id IS NULL;
SELECT * FROM tickets WHERE status NOT IN (...);

-- Fix data
UPDATE tickets SET client_id = ... WHERE client_id IS NULL;
UPDATE tickets SET status = 'NEW' WHERE status IS NULL;

-- Re-apply constraints
ALTER TABLE tickets ADD CONSTRAINT tickets_client_id_not_null CHECK (client_id IS NOT NULL);
```

### Issue: "Validation failing for legitimate requests"

**Cause**: Schema is too strict

**Solution**:
1. Check actual request format
2. Update schema if needed
3. Add data coercion/transformation
4. Gradually relax constraints

### Issue: "Rate limit errors increasing"

**Cause**: Limit too low for traffic

**Solution**:
1. Increase `RATE_LIMIT_MAX_REQUESTS` in `api-validation.ts`
2. Or implement per-endpoint limits
3. Or authenticate clients (exclude from rate limit)

### Issue: "Circuit breaker stuck OPEN"

**Cause**: External service failing

**Solution**:
```typescript
// Manual reset if needed
const breaker = getOrCreateCircuitBreaker('service-name');
breaker.reset(); // Force closed

// Or wait for timeout (default 60s)
```

---

## Success Criteria

Phase 2 deployment is successful when:

✅ All API endpoints return standardized responses
✅ Validation catches invalid requests (400s)
✅ Rate limiting prevents abuse (429s after limit)
✅ Database constraints prevent invalid data
✅ Retry logic recovers from transient failures
✅ Audit logs record all critical actions
✅ Logs appear in monitoring system
✅ Error rate < 1%
✅ No customer-impacting issues
✅ Team can respond to new error types

---

## What's Next

After Phase 2 deployment:

1. **Monitor in Production** (Week 1)
   - Watch logs daily
   - Review error patterns
   - Adjust thresholds as needed

2. **Team Training** (Week 1-2)
   - Present new error responses
   - Show examples of common issues
   - Share troubleshooting guide

3. **Phase 3 Planning** (Week 2+)
   - Error recovery strategies
   - Data migration tools
   - Performance optimization

---

## Support & Questions

For deployment questions:
1. Check `PHASE2_IMPLEMENTATION.md` for technical details
2. Review `PHASE2_QUICK_REFERENCE.md` for common patterns
3. See `PHASE2_EXAMPLES.ts` for working code

For issues during deployment:
1. Check "Troubleshooting" section above
2. Review rollback plan
3. Contact team lead
