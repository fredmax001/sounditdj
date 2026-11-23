import React from 'react'

/**
 * Official vector brand marks and emblems for supported DJ hardware and software ecosystems.
 */

export function RekordboxIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3.2a6.8 6.8 0 110 13.6 6.8 6.8 0 010-13.6zm0 2.4a4.4 4.4 0 100 8.8 4.4 4.4 0 000-8.8zm-1.8 2.2a2.2 2.2 0 112.2 2.2 2.2 2.2 0 01-2.2-2.2z" />
    </svg>
  )
}

export function PioneerIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4h3.6c2.4 0 4.2 1.4 4.2 3.6 0 2.2-1.8 3.6-4.2 3.6H6.4v4.8H4V4zm2.4 5.2h1.2c1.2 0 2-.6 2-1.6s-.8-1.6-2-1.6H6.4v3.2zm6.6-5.2h2.4v12H13V4zm5.2 6.8c0-3.1 2.2-5.2 5.4-5.2v2.2c-1.8 0-3 1.2-3 3s1.2 3 3 3v2.2c-3.2 0-5.4-2.1-5.4-5.2z" />
    </svg>
  )
}

export function SeratoIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 7.5L8.5 2h7L21 7.5v9L15.5 22h-7L3 16.5v-9zm2.2.8v7.4l4.2 4.2h5.2l4.2-4.2V8.3l-4.2-4.2H9.4L5.2 8.3zm6.8 1.2a2.5 2.5 0 110 5 2.5 2.5 0 010-5z" />
    </svg>
  )
}

export function EngineDjIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.4l6.8 3.8-3.4 1.9-6.8-3.8L12 4.4zM5.2 8.7l5.8 3.2v6.6l-5.8-3.2V8.7zm8 9.8v-6.6l5.8-3.2v6.6l-5.8 3.2z" />
    </svg>
  )
}

export function TraktorIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 5h6v6H3V5zm9 0h9v6h-9V5zm-9 8h9v6H3v-6zm12 0h6v6h-6v-6z" />
    </svg>
  )
}

export function VirtualDjIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 4h4.5l5.5 12 5.5-12H22l-8 16h-4L2 4zm10 2a2 2 0 110 4 2 2 0 010-4z" />
    </svg>
  )
}

export function UsbStorageIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="8" width="12" height="12" rx="2" />
      <path d="M9 8V4h6v4" />
      <line x1="10" y1="12" x2="10" y2="12.01" />
      <line x1="14" y1="12" x2="14" y2="12.01" />
    </svg>
  )
}

export function getProfileIcon(profileId, className = 'w-4 h-4') {
  switch (profileId) {
    case 'rekordbox-usb':
    case 'rekordbox-xml':
    case 'rekordbox':
      return <RekordboxIcon className={className} />
    case 'serato':
    case 'serato-usb':
      return <SeratoIcon className={className} />
    case 'engine-dj':
    case 'denon':
      return <EngineDjIcon className={className} />
    case 'traktor':
    case 'traktor-usb':
      return <TraktorIcon className={className} />
    case 'virtualdj':
    case 'virtualdj-usb':
      return <VirtualDjIcon className={className} />
    default:
      return <UsbStorageIcon className={className} />
  }
}
