import React from 'react'
import { HardDrive, Wifi, Cpu, Clock } from 'lucide-react'

function StatusBar() {
  const [time, setTime] = React.useState(new Date())

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="h-statusbar bg-background-primary border-t border-mixer-border flex items-center justify-between px-3 text-[10px] text-text-muted select-none">
      {/* Left: Status info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span>Ready</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wifi className="w-3 h-3" />
          <span>Online</span>
        </div>
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3 h-3" />
          <span>-- GB free</span>
        </div>
      </div>

      {/* Center: Track info / Status message */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <span>Drag tracks to decks or browse your library</span>
      </div>

      {/* Right: System info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3" />
          <span>--%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span className="font-mono">
            {time.toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
      </div>
    </div>
  )
}

export default StatusBar
