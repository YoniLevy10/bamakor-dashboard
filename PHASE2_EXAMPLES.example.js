/**
 * Phase 2 Integration Examples
 * Template implementations showing how to use Phase 2 utilities
 */

// ============================================================================
// EXAMPLE 1: Create Ticket API Route with Full Safety
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  parseRequest,
  ValidationSchemas,
  RequestValidator,
  ResponseBuilder,
  checkRateLimit,
  withErrorHandling,
} from '@/lib/api-validation';
import { withDatabaseRetry } from '@/lib/retry-logic';
import { getLogger, getAuditLogger, PerformanceMonitor } from '@/lib/logging';
import { createClient } from '@supabase/supabase-js';

export async function exampleCreateTicket_POST(request: NextRequest) {
  // Parse request
  const parsed = await parseRequest(request);
  if (!parsed) {
    return NextResponse.json(
      ...ResponseBuilder.error('Invalid request format', 'UNKNOWN'),
      { status: 400 }
    );
  }

  const [body, requestId, clientId] = parsed;
  const logger = getLogger();
  const audit = getAuditLogger();
  const monitor = new PerformanceMonitor('CREATE_TICKET_API');

  // Set logging context
  logger.setRequestContext(requestId, { clientId });

  try {
    // Rate limiting
    const rateLimitInfo = checkRateLimit(clientId, '/api/create-ticket');
    if (rateLimitInfo.isLimited) {
      logger.warn('RATE_LIMIT', 'Rate limit exceeded', { clientId });
      return NextResponse.json(
        ...ResponseBuilder.error('Too many requests', requestId),
        { status: 429 }
      );
    }

    // Validate request
    const validator = new RequestValidator();
    if (!validator.validate(body, ValidationSchemas.ticket.create)) {
      logger.warn('VALIDATION', 'Validation failed', { errors: validator.getErrors() });
      return NextResponse.json(
        ...ResponseBuilder.validationError(validator.getErrors(), requestId),
        { status: 400 }
      );
    }

    monitor.mark('validation-complete');

    // Create ticket with database retry
    const [ticket, error, statusCode] = await withErrorHandling(
      () =>
        withDatabaseRetry(
          async () => {
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            monitor.mark('db-operation-start');

            // Insert ticket
            const { data, error } = await supabase.from('tickets').insert([{
              client_id: clientId,
              project_id: body.project_id,
              title: body.title,
              description: body.description,
              priority: body.priority || 'MEDIUM',
              status: 'NEW',
            }]).select().single();

            if (error) throw new Error(error.message);
            return data;
          },
          'create-ticket',
          clientId
        ),
      requestId
    );

    if (error) {
      logger.error('DATABASE', `Failed to create ticket: ${error}`, undefined, { clientId });
      audit.logFailedOperation('CREATE', 'TICKET', 'unknown', clientId, error);
      return NextResponse.json(
        ...ResponseBuilder.error(error, requestId),
        { status: statusCode }
      );
    }

    monitor.mark('db-operation-complete');

    // Audit trail
    audit.logTicketCreated(clientId, ticket.id);

    // Success response
    monitor.end('create-ticket');
    logger.info('TICKET_API', 'Ticket created', { ticketId: ticket.id, clientId });

    return NextResponse.json(ResponseBuilder.success({ ticket }, requestId), { status: 201 });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('TICKET_API', 'Unexpected error', err, { clientId });
    return NextResponse.json(...ResponseBuilder.serverError(requestId), { status: 500 });
  } finally {
    logger.clearRequestContext(requestId);
  }
}

// ============================================================================
// EXAMPLE 2: Update Ticket API Route with Audit Trail
// ============================================================================

export async function exampleUpdateTicket_PATCH(request: NextRequest) {
  const parsed = await parseRequest(request);
  if (!parsed) {
    return NextResponse.json(...ResponseBuilder.error('Invalid request', 'UNKNOWN'), { status: 400 });
  }

  const [body, requestId, clientId] = parsed;
  const logger = getLogger();
  const audit = getAuditLogger();

  logger.setRequestContext(requestId, { clientId });

  try {
    // Validate update schema
    const validator = new RequestValidator();
    if (!validator.validate(body, ValidationSchemas.ticket.update)) {
      return NextResponse.json(
        ...ResponseBuilder.validationError(validator.getErrors(), requestId),
        { status: 400 }
      );
    }

    const ticketId = request.nextUrl.searchParams.get('id');
    if (!ticketId) {
      return NextResponse.json(...ResponseBuilder.error('Missing ticket ID', requestId), { status: 400 });
    }

    const [ticket, error, statusCode] = await withErrorHandling(
      () =>
        withDatabaseRetry(
          async () => {
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            // Get current ticket for change tracking
            const { data: currentTicket } = await supabase
              .from('tickets')
              .select()
              .eq('id', ticketId)
              .single();

            // Update ticket
            const { data, error } = await supabase
              .from('tickets')
              .update(body)
              .eq('id', ticketId)
              .select()
              .single();

            if (error) throw new Error(error.message);

            // Track changes for audit
            const changes: Record<string, { before: unknown; after: unknown }> = {};
            for (const [key, newValue] of Object.entries(body)) {
              if (currentTicket?.[key] !== newValue) {
                changes[key] = { before: currentTicket?.[key], after: newValue };
              }
            }

            // Log audit trail
            if (Object.keys(changes).length > 0) {
              audit.logTicketUpdated(clientId, ticketId, changes);
            }

            return data;
          },
          'update-ticket',
          clientId
        ),
      requestId
    );

    if (error) {
      audit.logFailedOperation('UPDATE', 'TICKET', ticketId, clientId, error);
      return NextResponse.json(
        ...ResponseBuilder.error(error, requestId),
        { status: statusCode }
      );
    }

    logger.info('TICKET_API', 'Ticket updated', { ticketId, clientId });
    return NextResponse.json(ResponseBuilder.success({ ticket }, requestId));

  } finally {
    logger.clearRequestContext(requestId);
  }
}

// ============================================================================
// EXAMPLE 3: Batch Operations with Error Recovery
// ============================================================================

import { withBatchRetry } from '@/lib/retry-logic';

export async function exampleBatchAssignTickets_POST(request: NextRequest) {
  const parsed = await parseRequest(request);
  if (!parsed) {
    return NextResponse.json(...ResponseBuilder.error('Invalid request', 'UNKNOWN'), { status: 400 });
  }

  const [body, requestId, clientId] = parsed;
  const logger = getLogger();
  const audit = getAuditLogger();

  logger.setRequestContext(requestId, { clientId });

  try {
    const { ticketIds, workerId } = body as { ticketIds: string[]; workerId: string };

    if (!Array.isArray(ticketIds) || !workerId) {
      return NextResponse.json(
        ...ResponseBuilder.error('Invalid request format', requestId),
        { status: 400 }
      );
    }

    // Batch assign with retry for each ticket
    const results = await withBatchRetry(
      ticketIds,
      async (ticketId) => {
        const [_, error] = await withErrorHandling(
          () =>
            withDatabaseRetry(
              async () => {
                const supabase = createClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.SUPABASE_SERVICE_ROLE_KEY!
                );

                const { data, error } = await supabase
                  .from('tickets')
                  .update({ assigned_to: workerId })
                  .eq('id', ticketId)
                  .select()
                  .single();

                if (error) throw new Error(error.message);
                return data;
              },
              'assign-ticket',
              clientId
            ),
          requestId
        );

        if (!error) {
          audit.logTicketAssigned(clientId, ticketId, workerId);
        }

        return !error;
      },
      'batch-assign-tickets'
    );

    logger.info('BATCH_API', 'Batch assignment completed', {
      succeeded: results.succeededCount,
      failed: results.failedCount,
      total: results.totalCount,
    });

    return NextResponse.json(
      ResponseBuilder.success(
        {
          succeeded: results.succeededCount,
          failed: results.failedCount,
          errors: results.errors.map((e) => ({ ticketIndex: e.index, message: e.error.message })),
        },
        requestId
      )
    );

  } finally {
    logger.clearRequestContext(requestId);
  }
}

// ============================================================================
// EXAMPLE 4: Error-Safe Endpoint with Circuit Breaker
// ============================================================================

import { getOrCreateCircuitBreaker } from '@/lib/retry-logic';

export async function exampleExternalAPICall_GET(request: NextRequest) {
  const requestId = 'request-' + Date.now();
  const logger = getLogger();

  try {
    const breaker = getOrCreateCircuitBreaker('external-service');

    const [result, error] = await withErrorHandling(
      () =>
        breaker.execute(async () => {
          // This will fail if circuit is OPEN
          return await fetch('https://external-api.com/data').then((r) => r.json());
        }),
      requestId
    );

    if (error) {
      logger.warn('EXTERNAL_API', `Call failed: ${error}`, { state: breaker.getState() });
      return NextResponse.json(
        ...ResponseBuilder.error('Service temporarily unavailable', requestId),
        { status: 503 }
      );
    }

    return NextResponse.json(ResponseBuilder.success(result, requestId));

  } finally {
    logger.clearRequestContext(requestId);
  }
}

// ============================================================================
// EXAMPLE 5: Monitoring & Health Check
// ============================================================================

export async function exampleHealthCheck_GET(_request: NextRequest) {
  const logger = getLogger();
  const stats = logger.getStatistics();

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    logger: {
      bufferSize: stats.bufferSize,
      contextSize: stats.contextSize,
    },
  });
}

// ============================================================================
// Integration Notes
// ============================================================================

/*
IMPLEMENTATION CHECKLIST:

1. Copy functions to their respective API route files
2. Remove the "example" prefix and export as default
3. Update Supabase client initialization if needed
4. Add these imports to package.json scripts:
   - Ensure TypeScript is configured properly
   - Add @types/node if missing

5. Testing:
   - Use provided curl examples from PHASE2_IMPLEMENTATION.md
   - Monitor console logs during development
   - Check Supabase logs for constraint violations

6. Production:
   - Configure LOGGING_ENDPOINT in environment
   - Set NODE_ENV=production
   - Monitor rate limiting metrics
   - Review audit logs regularly

TROUBLESHOOTING:

- "Validation failed": Check schema matches request body
- "Rate limited": Increase RATE_LIMIT_MAX_REQUESTS if legitimate traffic
- "Circuit breaker OPEN": External service is failing, check connectivity
- "Database constraint violated": Data doesn't match schema, review database-phase2-constraints.sql

*/
