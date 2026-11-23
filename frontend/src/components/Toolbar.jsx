import React from 'react'
import { Disc3, Minus, Square, X } from 'lucide-react'

function Toolbar() {
  return (
    <div className="h-toolbar bg-background-primary border-b border-mixer-border flex items-center justify-between px-3 select-none app-drag">
      {/* Left: App Name */}
      <div className="flex items-center gap-2">
        <Disc3 className="w-4 h-4 text-deck-a" />
        <span className="text-[11px] font-semibold text-text-secondary tracking-wide uppercase">
          Sound It DJ
        </span>
        <span className="text-[10px] text-text-disabled ml-1">v1.0.0</span>
      </div>

      {/* Center: Window Title */}
      <div className="absolute left-1/2 -translate-x-1/2 text-[11px] text-text-muted">
        Professional DJ Library & Mix Intelligence
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-1 no-drag">
        <button className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors" title="Minimize" />
        <button className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors" title="Maximize" />
        <button className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors" title="Close" />
      </div>
    </div>
  )
}

export default Toolbar
