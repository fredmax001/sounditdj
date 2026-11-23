import React from 'react'
import Integration from './Integration'

function IntegrationView({ activeSubItem }) {
  // The existing Integration page has tabs for SoundCloud, Boomplay, Audiomack, Shazam
  // We pass the activeSubItem to sync the active tab with sidebar navigation
  return (
    <div className="h-full overflow-auto">
      <Integration initialTab={activeSubItem} />
    </div>
  )
}

export default IntegrationView
