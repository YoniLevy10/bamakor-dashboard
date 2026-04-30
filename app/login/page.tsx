import { Suspense } from 'react'
import { LoginClient } from './login-client'

function LoginFallback() {
  return <LoginClientFallback />
}

function LoginClientFallback() {
  // Minimal fallback: avoid useSearchParams during prerender
  return (
    <div style={{ padding: '40px 16px', textAlign: 'center' }}>
      טוען…
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  )
}

