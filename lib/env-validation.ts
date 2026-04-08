/**
 * Environment validation utility for production deployments
 * This ensures all required environment variables are present
 * before the application starts
 */

export interface EnvironmentConfig {
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  whatsapp: {
    phoneNumberId: string
    accessToken: string
    verifyToken: string
  }
  vercel?: {
    projectId?: string
    deploymentId?: string
    environment?: string
  }
}

// List of required environment variables
const REQUIRED_ENV_VARS = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: 'string',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'string',
  SUPABASE_SERVICE_ROLE_KEY: 'string',

  // WhatsApp
  WHATSAPP_PHONE_NUMBER_ID: 'string',
  WHATSAPP_ACCESS_TOKEN: 'string',
  WHATSAPP_VERIFY_TOKEN: 'string',
} as const

/**
 * Validate that all required environment variables are set
 * @throws Error if any required variable is missing or invalid
 */
export function validateEnvironment(): EnvironmentConfig {
  const missing: string[] = []
  const errors: string[] = []

  // Check required variables
  for (const [key, type] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[key]

    if (!value) {
      missing.push(`${key} (${type})`)
    } else if (type === 'string' && typeof value !== 'string') {
      errors.push(`${key} is not a string`)
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables:\n${missing.map((m) => `  - ${m}`).join('\n')}`
    throw new Error(message)
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment variables:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  }

  // Return validated config
  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    whatsapp: {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
    },
    vercel: {
      projectId: process.env.VERCEL_PROJECT_ID,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
      environment: process.env.VERCEL_ENV,
    },
  }
}

/**
 * Check environment at startup (call from layout.tsx or next.config.ts)
 */
export function checkEnvironmentAtStartup() {
  if (typeof window === 'undefined') {
    // Only run on server
    try {
      validateEnvironment()
      console.log('✅ Environment variables validated successfully')
    } catch (error) {
      console.error('❌ Environment validation failed:')
      console.error(error)
      if (process.env.NODE_ENV === 'production') {
        // In production, you might want to fail fast
        // Uncomment the next line to crash on missing env vars
        // throw error
      }
    }
  }
}

/**
 * Get sanitized environment config for logging (removes sensitive values)
 */
export function getSanitizedEnvConfig() {
  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ (public)' : '✗',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ (secret)' : '✗',
    },
    whatsapp: {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? '✓' : '✗',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN ? '✓ (secret)' : '✗',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ? '✓ (secret)' : '✗',
    },
    node_env: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV || 'local',
  }
}
