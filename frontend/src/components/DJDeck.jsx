import React from 'react'
import { Play, Pause, Square, SkipBack, SkipForward, RotateCcw, Zap, Headphones } from 'lucide-react'
import usePlayerStore from '@store/playerStore'

function WaveformPlaceholder({ color, active }) {
  return (
    <div className={`relative h-24 bg-background-primary border-b border-mixer-border overflow-hidden ${active ? 'deck-active-' + color : ''}`}>
      {/* Grid lines */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />
      
      {/* Simulated waveform */}
      <div className="absolute inset-0 flex items-center justify-center gap-[2px] px-4">
        {Array.from({ length: 120 }).map((_, i) => {
          const height = Math.random() * 60 + 10
          const isCenter = i > 55 && i < 65
          return (
            <div
              key={i}
              className={`w-[3px] rounded-sm transition-all duration-300 ${
                isCenter ? `bg-${color} opacity-100` : `bg-${color} opacity-30`
              }`}
              style={{ height: `${height}%` }}
            />
          )
        })}
      </div>
      
      {/* Playhead */}
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/60 z-10">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-white/60" />
      </div>
      
      {/* Cue points */}
      <div className="absolute top-1 left-[20%] w-2 h-2 bg-yellow-500 rounded-full" />
      <div className="absolute top-1 left-[45%] w-2 h-2 bg-green-500 rounded-full" />
      <div className="absolute top-1 left-[75%] w-2 h-2 bg-red-500 rounded-full" />
    </div>
  )
}

function Knob({ label, value, color = 'text-text-secondary' }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-8 h-8 rounded-full bg-mixer-knob border border-mixer-border relative flex items-center justify-center">
        <div 
          className={`w-0.5 h-3 ${color} absolute top-1`}
          style={{ transform: `rotate(${value * 270 - 135}deg)`, transformOrigin: 'bottom center' }}
        />
      </div>
      <span className="text-[9px] text-text-muted uppercase tracking-wider">{label}</span>
    </div>
  )
}

function Fader({ label, color }) {
  return (
    <div className="flex flex-col items-center gap-1 h-full">
      <div className="flex-1 w-8 bg-mixer-fader border border-mixer-border relative rounded-sm">
        <div 
          className={`absolute left-0 right-0 h-6 ${color} border-t border-b border-white/20 flex items-center justify-center`}
          style={{ bottom: '60%' }}
        >
          <div className="w-full h-px bg-white/40" />
        </div>
      </div>
      <span className="text-[9px] text-text-muted uppercase tracking-wider">{label}</span>
    </div>
  )
}

function Deck({ side, track, isPlaying, onPlay, color, colorDim }) {
  const isLeft = side === 'A'
  
  return (
    <div className={`flex-1 flex flex-col border ${isLeft ? 'border-r-mixer-border' : 'border-l-mixer-border'} bg-background-secondary`}>
      {/* Deck Header */}
      <div className={`h-8 flex items-center justify-between px-3 border-b border-mixer-border ${colorDim}`}>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold ${color} tracking-wider`}>DECK {side}</span>
          {track && (
            <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'animate-pulse bg-green-500' : 'bg-text-disabled'}`} />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 text-text-muted hover:text-text-secondary transition-colors" title="Headphones">
            <Headphones className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Waveform */}
      <WaveformPlaceholder color={isLeft ? 'deck-a' : 'deck-b'} active={!!track} />

      {/* Track Info */}
      <div className="px-4 py-3 border-b border-mixer-border">
        {track ? (
          <div className="space-y-1">
            <div className="text-sm font-semibold text-text-primary truncate">
              {track.title || 'Unknown Title'}
            </div>
            <div className="text-[11px] text-text-secondary truncate">
              {track.artist || 'Unknown Artist'}
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <span className="text-[11px] text-text-muted">Drop track here</span>
          </div>
        )}
      </div>

      {/* BPM / Time Display */}
      <div className="px-4 py-2 border-b border-mixer-border flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] text-text-muted uppercase tracking-wider">BPM</span>
          <span className={`text-bpm ${color}`}>
            {track?.bpm ? Math.round(track.bpm) : '000.0'}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-text-muted uppercase tracking-wider">Time</span>
          <span className="text-time text-text-secondary">
            {track ? '00:00' : '--:--'}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-text-muted uppercase tracking-wider">Key</span>
          <span className="text-time text-text-secondary">
            {track?.key || '--'}
          </span>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="px-4 py-3 flex items-center justify-center gap-2">
        <button className="transport-btn w-8 h-8 transport-btn-cue text-[10px] font-bold">
          CUE
        </button>
        <button 
          onClick={onPlay}
          className={`transport-btn w-12 h-12 text-lg ${
            isPlaying 
              ? isLeft ? 'bg-deck-a text-white' : 'bg-deck-b text-white'
              : 'transport-btn-play'
          }`}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <button className={`transport-btn w-8 h-8 text-[10px] font-bold border ${
          isLeft 
            ? 'bg-deck-a-dim text-deck-a border-deck-a/30 hover:bg-deck-a/20' 
            : 'bg-deck-b-dim text-deck-b border-deck-b/30 hover:bg-deck-b/20'
        }`}>
          SYNC
        </button>
      </div>

      {/* Jog Wheel Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className={`w-36 h-36 rounded-full border-4 ${isPlaying ? `border-${isLeft ? 'deck-a' : 'deck-b'} shadow-glow-${isLeft ? 'deck-a' : 'deck-b'}` : 'border-mixer-border'} bg-background-primary relative flex items-center justify-center transition-all duration-500`}>
          <div className="w-28 h-28 rounded-full border border-mixer-border flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-text-secondary" />
          </div>
          {/* Marker */}
          <div className={`absolute top-2 left-1/2 -translate-x-1/2 w-1 h-3 ${isLeft ? 'bg-deck-a' : 'bg-deck-b'}`} />
        </div>
      </div>
    </div>
  )
}

function Mixer() {
  return (
    <div className="w-48 bg-mixer-bg border-x border-mixer-border flex flex-col">
      {/* Mixer Header */}
      <div className="h-8 flex items-center justify-center border-b border-mixer-border">
        <span className="text-[10px] font-bold text-text-muted tracking-widest">MIXER</span>
      </div>

      {/* EQ Section */}
      <div className="px-3 py-4 border-b border-mixer-border">
        <div className="flex justify-between">
          {/* Channel A EQ */}
          <div className="flex flex-col items-center gap-3">
            <Knob label="High" value={0.7} color="text-deck-a" />
            <Knob label="Mid" value={0.5} color="text-deck-a" />
            <Knob label="Low" value={0.6} color="text-deck-a" />
          </div>
          
          {/* Channel B EQ */}
          <div className="flex flex-col items-center gap-3">
            <Knob label="High" value={0.6} color="text-deck-b" />
            <Knob label="Mid" value={0.5} color="text-deck-b" />
            <Knob label="Low" value={0.7} color="text-deck-b" />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="px-3 py-3 border-b border-mixer-border flex justify-between">
        <Knob label="Filter" value={0.5} color="text-deck-a" />
        <Knob label="Filter" value={0.5} color="text-deck-b" />
      </div>

      {/* Volume Faders */}
      <div className="flex-1 px-3 py-4 flex justify-between">
        <Fader label="Vol A" color="bg-deck-a" />
        <div className="flex flex-col items-center justify-center gap-1">
          <div className="flex flex-col gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={`w-4 h-[3px] ${i < 7 ? 'bg-green-500/60' : i < 9 ? 'bg-yellow-500/60' : 'bg-red-500/60'}`} />
            ))}
          </div>
        </div>
        <Fader label="Vol B" color="bg-deck-b" />
      </div>

      {/* Crossfader */}
      <div className="px-3 py-3 border-t border-mixer-border">
        <div className="flex items-center justify-between text-[9px] text-text-muted mb-1">
          <span>A</span>
          <span>CROSSFADER</span>
          <span>B</span>
        </div>
        <div className="h-6 bg-mixer-fader border border-mixer-border relative rounded-sm">
          <div 
            className="absolute top-0 bottom-0 w-8 bg-text-primary border-x border-white/20 flex items-center justify-center"
            style={{ left: '45%' }}
          >
            <div className="w-full h-px bg-white/40" />
          </div>
        </div>
      </div>
    </div>
  )
}

function DJDeck() {
  const { currentTrack, isPlaying, setCurrentTrack, togglePlay } = usePlayerStore()
  
  // Mock second deck track
  const deckBTrack = null

  return (
    <div className="flex-1 flex flex-col bg-background-primary overflow-hidden">
      {/* Decks + Mixer */}
      <div className="flex-1 flex min-h-0">
        <Deck 
          side="A" 
          track={currentTrack}
          isPlaying={isPlaying}
          onPlay={togglePlay}
          color="text-deck-a"
          colorDim="bg-deck-a-dim"
        />
        <Mixer />
        <Deck 
          side="B" 
          track={deckBTrack}
          isPlaying={false}
          onPlay={() => {}}
          color="text-deck-b"
          colorDim="bg-deck-b-dim"
        />
      </div>
    </div>
  )
}

export default DJDeck
