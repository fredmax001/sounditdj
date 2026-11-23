import React from 'react'

const SIZE_MAP = {
  xs: {
    height: 'h-6',
    width: 'w-auto',
  },
  sm: {
    height: 'h-10',
    width: 'w-auto',
  },
  md: {
    height: 'h-16',
    width: 'w-auto',
  },
  lg: {
    height: 'h-24',
    width: 'w-auto',
  },
  xl: {
    height: 'h-32',
    width: 'w-auto',
  },
}

function BrandMark({ size = 'md', variant = 'wordmark', className = '', centered = false }) {
  const styles = SIZE_MAP[size] || SIZE_MAP.md
  const src = variant === 'emblem' || variant === 'badge' ? './brandmark.jpg' : './logo.png'

  return (
    <div className={`inline-flex items-center ${centered ? 'justify-center' : ''} ${className}`}>
      <img 
        src={src} 
        alt="SOUND IT DJ"
        className={`${styles.height} ${styles.width} object-contain ${variant === 'emblem' ? 'rounded-lg shadow-lg' : ''}`}
      />
    </div>
  )
}

export default BrandMark
