'use client'

import { type CSSProperties } from 'react'
import { theme } from '../ui'

interface ImageLightboxProps {
  imageUrl: string | null
  onClose: () => void
}

export function ImageLightbox({ imageUrl, onClose }: ImageLightboxProps) {
  if (!imageUrl) return null

  return (
    <>
      <div style={styles.lightboxOverlay} onClick={onClose} />
      <div style={styles.lightbox}>
        <button onClick={onClose} style={styles.lightboxClose}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        <img src={imageUrl} alt="Attachment" style={styles.lightboxImg} crossOrigin="anonymous" />
      </div>
    </>
  )
}

const styles: Record<string, CSSProperties> = {
  lightboxOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.9)',
    zIndex: 200,
  },
  lightbox: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 201,
    maxWidth: '90vw',
    maxHeight: '90vh',
  },
  lightboxClose: {
    position: 'absolute',
    top: '-40px',
    right: 0,
    background: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
  },
  lightboxImg: {
    maxWidth: '90vw',
    maxHeight: '85vh',
    objectFit: 'contain',
    borderRadius: theme.radius.lg,
  },
}
