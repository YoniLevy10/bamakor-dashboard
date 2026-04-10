/**
 * Retry Logic & Exponential Backoff - Phase 2: Data Safety
 * Handles transient failures gracefully with intelligent retry strategies
 */

// ============================================================================
// 1. RETRY CONFIGURATION
// ============================================================================

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number; // 0-1, adds randomness to prevent thundering herd
  retryableErrors: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableErrors: [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'net::ERR_NETWORK_CHANGED',
  ],
};

// ============================================================================
// 2. RETRY STATE TRACKING
// ============================================================================

export interface RetryAttempt {
  attemptNumber: number;
  error: Error | null;
  delayMs: number;
  timestamp: number;
}

export class RetryTracker {
  private attempts: RetryAttempt[] = [];
  private operationId: string;

  constructor(operationId: string) {
    this.operationId = operationId;
  }

  recordAttempt(error: Error | null, delayMs: number): void {
    this.attempts.push({
      attemptNumber: this.attempts.length + 1,
      error,
      delayMs,
      timestamp: Date.now(),
    });
  }

  getAttempts(): RetryAttempt[] {
    return [...this.attempts];
  }

  getSummary(): {
    totalAttempts: number;
    totalTimeMs: number;
    finalError: Error | null;
    succeeded: boolean;
  } {
    const totalAttempts = this.attempts.length;
    const firstAttempt = this.attempts[0];
    const lastAttempt = this.attempts[totalAttempts - 1];
    const totalTimeMs = lastAttempt.timestamp - (firstAttempt?.timestamp || 0);
    const finalError = lastAttempt?.error || null;
    const succeeded = finalError === null;

    return {
      totalAttempts,
      totalTimeMs,
      finalError,
      succeeded,
    };
  }

  toString(): string {
    const summary = this.getSummary();
    return (
      `[${this.operationId}] Attempts: ${summary.totalAttempts}, ` +
      `Time: ${summary.totalTimeMs}ms, ` +
      `Success: ${summary.succeeded}`
    );
  }
}

// ============================================================================
// 3. EXPONENTIAL BACKOFF CALCULATOR
// ============================================================================

export class BackoffCalculator {
  constructor(private config: RetryConfig) {}

  calculateDelay(attemptNumber: number): number {
    // Attempt 1 = no delay, Attempt 2 = initial delay, etc
    if (attemptNumber <= 1) return 0;

    const exponentialDelay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber - 2);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.config.jitterFactor * Math.random();
    return Math.floor(cappedDelay + jitter);
  }

  isRetryable(error: Error): boolean {
    const errorString = `${error.name} ${error.message}`;
    return this.config.retryableErrors.some((retryableError) => errorString.includes(retryableError));
  }
}

// ============================================================================
// 4. DELAY UTILITY
// ============================================================================

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// 5. CORE RETRY FUNCTION
// ============================================================================

export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: RetryAttempt) => void,
): Promise<T> {
  const tracker = new RetryTracker(operationName);
  const calculator = new BackoffCalculator(config);

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      tracker.recordAttempt(null, 0);
      const result = await operation();
      console.log(`✓ ${tracker.toString()}`);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const isRetryable = calculator.isRetryable(err);
      const shouldRetry = attempt < config.maxAttempts && isRetryable;

      if (shouldRetry) {
        const delayMs = calculator.calculateDelay(attempt);
        tracker.recordAttempt(err, delayMs);

        console.warn(
          `⚠ Retry ${attempt}/${config.maxAttempts} for "${operationName}": ` +
            `${err.message} (waiting ${delayMs}ms)`,
        );

        if (onRetry) {
          onRetry(tracker.getAttempts()[attempt - 1]);
        }

        await delay(delayMs);
      } else {
        tracker.recordAttempt(err, 0);
        console.error(`✗ ${tracker.toString()} - ${err.message}`);
        throw err;
      }
    }
  }

  // Should not reach here, but return fallback
  throw new Error(`${operationName} failed after ${config.maxAttempts} attempts`);
}

// ============================================================================
// 6. DATABASE-SPECIFIC RETRY HANDLERS
// ============================================================================

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  clientId?: string,
): Promise<T> {
  const dbRetryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 200,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.15,
    retryableErrors: [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'connection timeout',
      'pool exhausted',
      'SERIALIZATION_FAILURE',
    ],
  };

  try {
    return await withRetry(operation, `[DB] ${operationName}`, dbRetryConfig);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Database operation failed: ${errorMsg}${clientId ? ` (client: ${clientId})` : ''}`);
  }
}

// ============================================================================
// 7. EXTERNAL API-SPECIFIC RETRY HANDLERS
// ============================================================================

export async function withExternalApiRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  apiName: string = 'External API',
): Promise<T> {
  const apiRetryConfig: RetryConfig = {
    maxAttempts: 5,
    initialDelayMs: 300,
    maxDelayMs: 30000,
    backoffMultiplier: 2.5,
    jitterFactor: 0.2,
    retryableErrors: [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'rate limit',
      'temporarily unavailable',
      'service unavailable',
      '502',
      '503',
      '504',
    ],
  };

  try {
    return await withRetry(operation, `[${apiName}] ${operationName}`, apiRetryConfig, (attempt) => {
      console.warn(`API call attempt ${attempt.attemptNumber} for ${operationName}`);
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`${apiName} operation failed: ${errorMsg}`);
  }
}

// ============================================================================
// 8. BATCH OPERATION WITH RETRY
// ============================================================================

export interface BatchRetryResult<T> {
  succeededCount: number;
  failedCount: number;
  totalCount: number;
  results: (T | Error)[];
  errors: Array<{ index: number; error: Error }>;
}

export async function withBatchRetry<T>(
  items: T[],
  operation: (item: T, index: number) => Promise<unknown>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<BatchRetryResult<T>> {
  const results: (unknown | Error)[] = [];
  const errors: Array<{ index: number; error: Error }> = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const result = await withRetry(
        () => operation(items[i], i),
        `${operationName}[${i}/${items.length}]`,
        config,
      );
      results.push(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      results.push(err);
      errors.push({ index: i, error: err });
    }
  }

  const succeededCount = items.length - errors.length;
  const failedCount = errors.length;

  console.log(`Batch operation "${operationName}": ${succeededCount}/${items.length} succeeded`);

  return {
    succeededCount,
    failedCount,
    totalCount: items.length,
    results: results as (Error | T)[],
    errors,
  };
}

// ============================================================================
// 9. CIRCUIT BREAKER PATTERN
// ============================================================================

export interface CircuitBreakerConfig {
  failureThreshold: number; // Count of failures before opening
  successThreshold: number; // Count of successes needed to close from half-open
  timeout: number; // Time in ms before trying again (half-open)
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private operationName: string;
  private config: CircuitBreakerConfig;

  constructor(operationName: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.operationName = operationName;
    this.config = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      ...config,
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        console.log(`[${this.operationName}] Circuit breaker transitioning to HALF_OPEN`);
      } else {
        throw new Error(`[${this.operationName}] Circuit breaker is OPEN`);
      }
    }

    try {
      const result = await operation();

      if (this.state === CircuitState.HALF_OPEN) {
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.state = CircuitState.CLOSED;
          this.failureCount = 0;
          console.log(`[${this.operationName}] Circuit breaker transitioning to CLOSED`);
        }
      } else if (this.state === CircuitState.CLOSED) {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.OPEN;
        console.error(`[${this.operationName}] Circuit breaker transitioning to OPEN (during HALF_OPEN test)`);
      } else if (this.failureCount >= this.config.failureThreshold) {
        this.state = CircuitState.OPEN;
        console.error(`[${this.operationName}] Circuit breaker transitioning to OPEN (threshold reached)`);
      }

      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

// ============================================================================
// 10. CACHED CIRCUIT BREAKERS
// ============================================================================

const circuitBreakers = new Map<string, CircuitBreaker>();

export function getOrCreateCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>,
): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, config));
  }
  return circuitBreakers.get(name)!;
}
