import React from 'react'
import Converter from './Converter'
import Analyzer from './Analyzer'
import USBExport from './USBExport'
import SoundItDJMixes from './SoundItDJMixes'
import Integration from './Integration'
import DuplicateFinder from './DuplicateFinder'
import FindReplace from './FindReplace'
import MissingTracks from './MissingTracks'
import Visualizer from './Visualizer'
import CoverArt from './CoverArt'
function ToolsView({ activeSubItem }) {
  switch (activeSubItem) {
    case 'converter':
      return (
        <div className="h-full overflow-auto">
          <Converter />
        </div>
      )
    case 'analyzer':
      return (
        <div className="h-full overflow-auto">
          <Analyzer />
        </div>
      )
    case 'identifier':
      return (
        <div className="h-full overflow-auto">
          <Integration />
        </div>
      )
    case 'duplicate-finder':
      return (
        <div className="h-full overflow-auto">
          <DuplicateFinder />
        </div>
      )
    case 'find-replace':
      return (
        <div className="h-full overflow-auto">
          <FindReplace />
        </div>
      )
    case 'missing-tracks':
      return (
        <div className="h-full overflow-auto">
          <MissingTracks />
        </div>
      )
    case 'usb-export':
      return (
        <div className="h-full overflow-auto">
          <USBExport />
        </div>
      )
    case 'dj-mixes':
      return (
        <div className="h-full overflow-auto">
          <SoundItDJMixes />
        </div>
      )
    case 'visualizer':
      return (
        <div className="h-full overflow-auto">
          <Visualizer />
        </div>
      )
    case 'cover-art':
      return (
        <div className="h-full overflow-auto">
          <CoverArt />
        </div>
      )
    default:
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-text-primary capitalize mb-2">{activeSubItem.replace(/-/g, ' ')}</h2>
            <p className="text-sm text-text-muted">Select a tool from the sidebar.</p>
          </div>
        </div>
      )
  }
}

export default ToolsView
