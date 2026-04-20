import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#F9F9FB',
        textAlign: 'center',
      }}
    >
      <Image src="/apple-icon.png" alt="Bamakor" width={64} height={64} style={{ borderRadius: 12, marginBottom: 24 }} />
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1A1A2E', margin: '0 0 8px' }}>הדף לא נמצא</h1>
      <p style={{ fontSize: 15, color: '#86868B', margin: '0 0 24px', maxWidth: 360 }}>
        הקישור שגוי או שהדף הוסר. חזרו ללוח הבקרה כדי להמשיך.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          background: '#0066FF',
          color: '#fff',
          borderRadius: 12,
          fontWeight: 600,
          fontSize: 15,
          textDecoration: 'none',
        }}
      >
        חזרה ללוח הבקרה
      </Link>
    </div>
  )
}
