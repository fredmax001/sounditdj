/**
 * Normalized DJ library model.
 *
 * Every importer produces this shape and every exporter consumes it. Keeping a
 * single model means a Serato crate, a rekordbox XML file and a VirtualDJ
 * database all become comparable records before anything is written to disk.
 *
 * Times are seconds (floating point) unless a field name explicitly ends in
 * `Ms`. Colors are `#RRGGBB` strings. All parsers should leave unknown values
 * null instead of inventing defaults, so compatibility reports stay honest.
 */

export const MODEL_VERSION = 1

export const CUE_KINDS = Object.freeze({
  HOT: 'hot',
  MEMORY: 'memory',
})

export const SOURCE_FORMATS = Object.freeze({
  SERATO: 'serato',
  REKORDBOX_XML: 'rekordbox-xml',
  REKORDBOX_USB: 'rekordbox-usb',
  VIRTUALDJ: 'virtualdj',
  APPLE_MUSIC: 'apple-music',
  TRAKTOR: 'traktor',
  M3U: 'm3u',
  CSV: 'csv',
  JSON: 'json',
  FOLDER: 'folder',
})

export const TARGET_PROFILES = Object.freeze({
  'rekordbox-usb': {
    id: 'rekordbox-usb',
    label: 'Rekordbox USB (CDJ / XDJ)',
    description: 'Pioneer/AlphaTheta USB with PDB database and ANLZ analysis files.',
    writesAudio: true,
    requiresDevice: true,
    hardwareValidation: 'pending',
    cueLimit: 8,
    memoryCueLimit: 10,
    fields: {
      title: true, artist: true, album: true, genre: true, comment: true,
      bpm: true, key: true, duration: true, rating: true, color: true,
      dateAdded: true, trackNumber: true, year: true,
      hotCues: true, memoryCues: true, loops: true, beatgrid: true,
      playlists: true, folderHierarchy: true, artwork: false,
    },
    notes: [
      'Hot cue limit depends on CDJ/XDJ model; 8 is the safe upper bound and extra cues are reported, never dropped silently.',
      'PDB/ANLZ output is structurally validated by this application. It has not been tested on physical CDJ hardware.',
      'Artwork is embedded in audio files where the source format allows it; PDB artwork is not written.',
    ],
  },
  'rekordbox-xml': {
    id: 'rekordbox-xml',
    label: 'Rekordbox XML',
    description: 'Portable XML collection/playlist file for rekordbox import.',
    writesAudio: false,
    requiresDevice: false,
    hardwareValidation: 'not-applicable',
    cueLimit: 8,
    memoryCueLimit: null,
    fields: {
      title: true, artist: true, album: true, genre: true, comment: true,
      bpm: true, key: true, duration: true, rating: true, color: true,
      dateAdded: true, trackNumber: true, year: true,
      hotCues: true, memoryCues: true, loops: true, beatgrid: true,
      playlists: true, folderHierarchy: true, artwork: false,
    },
    notes: [
      'Audio files are not bundled. The XML references their original locations.',
      'Memory cue and loop support depends on the rekordbox version importing the XML.',
    ],
  },
  'serato': {
    id: 'serato',
    label: 'Serato DJ (crates + tags)',
    description: 'Serato crate files plus ID3/FLAC performance tags for audio.',
    writesAudio: true,
    requiresDevice: false,
    hardwareValidation: 'not-applicable',
    cueLimit: 8,
    memoryCueLimit: 0,
    fields: {
      title: true, artist: true, album: true, genre: true, comment: true,
      bpm: true, key: true, duration: true, rating: true, color: true,
      dateAdded: true, trackNumber: false, year: true,
      hotCues: true, memoryCues: false, loops: true, beatgrid: true,
      playlists: true, folderHierarchy: true, artwork: false,
    },
    notes: [
      'Cues and loops are written to Serato Markers2 tags; beatgrid to Serato BeatGrid.',
      'Serato has no memory-cue concept, so memory cues are converted to hot cues when a free slot exists.',
      'The Serato library database is never modified. Exports create new crate files.',
    ],
  },
  'virtualdj': {
    id: 'virtualdj',
    label: 'VirtualDJ database XML',
    description: 'VirtualDJ database XML with marks, playlists and beatgrid.',
    writesAudio: false,
    requiresDevice: false,
    hardwareValidation: 'not-applicable',
    cueLimit: 8,
    memoryCueLimit: 8,
    fields: {
      title: true, artist: true, album: true, genre: true, comment: true,
      bpm: true, key: true, duration: true, rating: true, color: false,
      dateAdded: true, trackNumber: true, year: true,
      hotCues: true, memoryCues: true, loops: true, beatgrid: true,
      playlists: true, folderHierarchy: true, artwork: false,
    },
    notes: [
      'VirtualDJ XML has no portable per-track color-label field; color labels are reported as lost.',
      'Audio files are not bundled. The XML references their original locations.',
    ],
  },
  'apple-music': {
    id: 'apple-music',
    label: 'Apple Music / iTunes XML',
    description: 'iTunes-style library XML with playlists.',
    writesAudio: false,
    requiresDevice: false,
    hardwareValidation: 'not-applicable',
    cueLimit: 0,
    memoryCueLimit: 0,
    fields: {
      title: true, artist: true, album: true, genre: true, comment: true,
      bpm: false, key: false, duration: true, rating: true, color: false,
      dateAdded: true, trackNumber: true, year: true,
      hotCues: false, memoryCues: false, loops: false, beatgrid: false,
      playlists: true, folderHierarchy: true, artwork: false,
    },
    notes: [
      'Apple Music XML cannot represent DJ cue points, loops or beatgrids.',
      'Streaming and DRM-protected tracks cannot be copied or exported for DJ use.',
    ],
  },
  'generic-usb': {
    id: 'generic-usb',
    label: 'General audio USB',
    description: 'Audio files plus M3U/CSV playlists for any player.',
    writesAudio: true,
    requiresDevice: true,
    hardwareValidation: 'not-applicable',
    cueLimit: 0,
    memoryCueLimit: 0,
    fields: {
      title: true, artist: true, album: true, genre: true, comment: true,
      bpm: false, key: false, duration: true, rating: false, color: false,
      dateAdded: false, trackNumber: true, year: true,
      hotCues: false, memoryCues: false, loops: false, beatgrid: false,
      playlists: true, folderHierarchy: false, artwork: false,
    },
    notes: [
      'No DJ performance metadata is written.',
      'Playback order and metadata are preserved through M3U and CSV sidecar files.',
    ],
  },
})

export const IMPORT_FORMATS = Object.freeze({
  serato: {
    id: 'serato',
    label: 'Serato DJ',
    extensions: ['.crate', 'database V2'],
    capabilities: ['library', 'crates', 'hotCues', 'loops', 'beatgrid', 'bpm', 'key'],
    limitations: [
      'Local Serato database paths must be relinked if the library moved.',
      'Cue data comes from audio file tags, not the library database.',
    ],
  },
  'rekordbox-xml': {
    id: 'rekordbox-xml',
    label: 'Rekordbox XML',
    extensions: ['.xml'],
    capabilities: ['library', 'playlists', 'folders', 'hotCues', 'memoryCues', 'loops', 'beatgrid', 'bpm', 'key'],
    limitations: [
      'The encrypted local rekordbox master.db is not supported; export XML from rekordbox first.',
    ],
  },
  'rekordbox-usb': {
    id: 'rekordbox-usb',
    label: 'Rekordbox USB',
    extensions: ['PIONEER/rekordbox/export.pdb'],
    capabilities: ['library', 'playlists', 'hotCues', 'memoryCues', 'loops', 'beatgrid'],
    limitations: [
      'Only reads USB exports that include PIONEER/rekordbox/export.pdb.',
      'Physical CDJ behaviour is not verified in this build.',
    ],
  },
  virtualdj: {
    id: 'virtualdj',
    label: 'VirtualDJ',
    extensions: ['.xml'],
    capabilities: ['library', 'playlists', 'hotCues', 'memoryCues', 'loops', 'beatgrid', 'bpm', 'key'],
    limitations: ['Only VirtualDJ database XML is supported, not its proprietary cache files.'],
  },
  'apple-music': {
    id: 'apple-music',
    label: 'Apple Music / iTunes',
    extensions: ['.xml', '.plist'],
    capabilities: ['library', 'playlists', 'folders'],
    limitations: [
      'No cue points, loops or beatgrid exist in Apple Music XML.',
      'Streaming/DRM tracks are flagged and cannot be exported.',
    ],
  },
  traktor: {
    id: 'traktor',
    label: 'Traktor',
    extensions: ['.nml'],
    capabilities: ['library', 'playlists', 'hotCues', 'loops', 'beatgrid', 'bpm', 'key'],
    limitations: ['Traktor export is not implemented; import is read-only.'],
  },
  m3u: {
    id: 'm3u',
    label: 'M3U / M3U8 playlist',
    extensions: ['.m3u', '.m3u8'],
    capabilities: ['playlist'],
    limitations: ['No performance metadata.'],
  },
  csv: {
    id: 'csv',
    label: 'CSV',
    extensions: ['.csv'],
    capabilities: ['playlist', 'metadata'],
    limitations: ['No cue points unless the CSV has explicit cue columns.'],
  },
  json: {
    id: 'json',
    label: 'Sound It DJ JSON',
    extensions: ['.json'],
    capabilities: ['library', 'playlists', 'hotCues', 'memoryCues', 'loops', 'beatgrid'],
    limitations: [],
  },
  folder: {
    id: 'folder',
    label: 'Folder scan',
    extensions: [],
    capabilities: ['library'],
    limitations: ['No playlists unless M3U/CSV sidecars are present.'],
  },
})

export function createLibrary(source, overrides = {}) {
  return {
    modelVersion: MODEL_VERSION,
    source: source || 'unknown',
    sourceVersion: null,
    generatedAt: new Date().toISOString(),
    tracks: [],
    playlists: [],
    warnings: [],
    unsupported: [],
    ...overrides,
  }
}

export function createTrack(overrides = {}) {
  return {
    sourceId: null,
    title: null,
    artist: null,
    album: null,
    albumArtist: null,
    genre: null,
    comment: null,
    composer: null,
    bpm: null,
    key: null,
    duration: null,
    path: null,
    filename: null,
    fileSize: null,
    bitrate: null,
    sampleRate: null,
    trackNumber: null,
    discNumber: null,
    year: null,
    rating: null,
    color: null,
    dateAdded: null,
    playCount: null,
    cues: [],
    loops: [],
    beatgrid: null,
    tags: [],
    streaming: false,
    protected: false,
    missing: false,
    sourceMeta: {},
    ...overrides,
  }
}

export function createCue(overrides = {}) {
  return {
    kind: CUE_KINDS.HOT,
    slot: null,
    name: null,
    position: 0,
    color: null,
    comment: null,
    sourceId: null,
    ...overrides,
  }
}

export function createLoop(overrides = {}) {
  return {
    slot: null,
    name: null,
    start: 0,
    end: 0,
    color: null,
    comment: null,
    locked: false,
    sourceId: null,
    ...overrides,
  }
}

export function createBeatgrid(overrides = {}) {
  return {
    bpm: null,
    anchor: 0,
    timeSignature: 4,
    locked: false,
    beats: null,
    ...overrides,
  }
}

export function createPlaylist(overrides = {}) {
  return {
    sourceId: null,
    name: 'Untitled',
    parentId: null,
    isFolder: false,
    trackIds: [],
    sourceTrackRefs: [],
    children: [],
    ...overrides,
  }
}

/** Build a stable key for de-duplication across path variants. */
export function trackMatchKey(track = {}) {
  if (track.path) {
    return `${normalizePath(track.path)}|${String(track.fileSize || '').trim()}`
  }
  return [
    String(track.artist || '').trim().toLowerCase(),
    String(track.title || '').trim().toLowerCase(),
    String(track.album || '').trim().toLowerCase(),
    track.duration ? Math.round(Number(track.duration)) : '',
  ].join('|')
}

export function normalizePath(value = '') {
  return String(value || '')
    .replace(/^file:\/\/localhost/i, '')
    .replace(/^file:\/\//i, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .toLowerCase()
}

/**
 * Match a track against existing tracks. Uses a tiered strategy so a basename
 * collision does not incorrectly win over an exact path.
 */
export function findTrackMatch(track, candidates = [], options = {}) {
  const relink = options.relink || []
  const sourcePath = normalizePath(track.path)
  const base = basename(track.path)

  if (sourcePath) {
    for (const candidate of candidates) {
      if (normalizePath(candidate.path) === sourcePath) return candidate
    }

    for (const rule of relink) {
      if (!rule?.from || !rule?.to) continue
      if (sourcePath.startsWith(normalizePath(rule.from))) {
        const remapped = normalizePath(rule.to) + sourcePath.slice(normalizePath(rule.from).length)
        for (const candidate of candidates) {
          if (normalizePath(candidate.path) === remapped) return candidate
        }
      }
    }

    if (base) {
      const byBase = candidates.filter((candidate) => basename(candidate.path) === base)
      if (byBase.length === 1) return byBase[0]
    }
  }

  const artist = String(track.artist || '').trim().toLowerCase()
  const title = String(track.title || '').trim().toLowerCase()
  if (artist && title) {
    const matches = candidates.filter(
      (candidate) =>
        String(candidate.artist || '').trim().toLowerCase() === artist &&
        String(candidate.title || '').trim().toLowerCase() === title,
    )
    if (matches.length === 1) return matches[0]
  }

  return null
}

export function basename(filePath = '') {
  return String(filePath || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || ''
}

export function findCrossFormatMatches(library, candidates = [], options = {}) {
  const used = new Set()
  return library.tracks.map((track) => {
    const match = findTrackMatch(track, candidates.filter((c) => !used.has(c.id || c.path)), options)
    if (match) used.add(match.id || match.path)
    return { sourceTrack: track, targetTrack: match || null }
  })
}

export function summarizeLibrary(library) {
  const tracks = library?.tracks || []
  const playlists = library?.playlists || []
  const hotCues = tracks.reduce(
    (total, track) => total + (track.cues || []).filter((cue) => cue.kind !== CUE_KINDS.MEMORY).length,
    0,
  )
  const memoryCues = tracks.reduce(
    (total, track) => total + (track.cues || []).filter((cue) => cue.kind === CUE_KINDS.MEMORY).length,
    0,
  )
  const loops = tracks.reduce((total, track) => total + (track.loops || []).length, 0)
  return {
    tracks: tracks.length,
    playlists: playlists.filter((p) => !p.isFolder).length,
    folders: playlists.filter((p) => p.isFolder).length,
    hotCues,
    memoryCues,
    loops,
    beatgrids: tracks.filter((track) => track.beatgrid?.bpm || track.bpm).length,
    missingFiles: tracks.filter((track) => track.missing).length,
    streaming: tracks.filter((track) => track.streaming).length,
    protected: tracks.filter((track) => track.protected).length,
    cues: hotCues + memoryCues,
  }
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null
  const match = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!match) return null
  return {
    r: parseInt(match[1].slice(0, 2), 16),
    g: parseInt(match[1].slice(2, 4), 16),
    b: parseInt(match[1].slice(4, 6), 16),
  }
}

export function rgbToHex(red, green, blue) {
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(Number(value) || 0)))
  return `#${[clamp(red), clamp(green), clamp(blue)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

export function normalizeColor(value, fallback = null) {
  if (!value) return fallback
  if (typeof value === 'object' && value.r !== undefined) {
    return rgbToHex(value.r, value.g, value.b)
  }
  const str = String(value).trim()
  if (/^#[0-9a-f]{6}$/i.test(str)) return str.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(str)) {
    return `#${str[1]}${str[1]}${str[2]}${str[2]}${str[3]}${str[3]}`.toUpperCase()
  }
  const mobile = str.match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/)
  if (mobile) return rgbToHex(Number(mobile[1]), Number(mobile[2]), Number(mobile[3]))
  return fallback
}

/**
 * Build a compatibility report for exporting a normalized library to a target.
 * It never claims support that TARGET_PROFILES does not declare.
 */
export function buildCompatibilityReport(library, targetId, options = {}) {
  const target = TARGET_PROFILES[targetId]
  if (!target) throw new Error(`Unknown export target: ${targetId}`)

  const summary = summarizeLibrary(library)
  const issues = []
  const supported = []
  const converted = []
  const skipped = []
  const lost = []
  const perTrack = []

  const pushIssue = (level, code, message, track = null) => {
    issues.push({
      level,
      code,
      message,
      trackId: track?.sourceId || track?.id || null,
      trackTitle: track?.title || null,
    })
  }

  for (const track of library.tracks || []) {
    const trackLost = []
    const trackConverted = []
    const trackSkipped = []
    if (track.streaming) {
      trackSkipped.push('streaming')
      pushIssue('error', 'streaming-track', `"${track.title || 'Untitled'}" is a streaming track and cannot be exported.`, track)
    }
    if (track.protected) {
      trackSkipped.push('protected')
      pushIssue('error', 'protected-track', `"${track.title || 'Untitled'}" is DRM protected and cannot be exported.`, track)
    }
    if (track.missing) {
      trackSkipped.push('missing-file')
      pushIssue('warning', 'missing-file', `"${track.title || 'Untitled'}" has no accessible audio file.`, track)
    }
    if (track.cues?.length && !target.fields.hotCues) {
      trackLost.push('hot-cues')
      pushIssue('warning', 'unsupported-hot-cues', `Hot cues cannot be represented by ${target.label}.`, track)
    }
    const hotCues = (track.cues || []).filter((cue) => cue.kind !== CUE_KINDS.MEMORY)
    if (target.cueLimit != null && hotCues.length > target.cueLimit) {
      trackLost.push('cue-overflow')
      pushIssue(
        'warning',
        'cue-overflow',
        `"${track.title || 'Untitled'}" has ${hotCues.length} hot cues; ${target.label} supports up to ${target.cueLimit} without truncation.`,
        track,
      )
    }
    const memoryCues = (track.cues || []).filter((cue) => cue.kind === CUE_KINDS.MEMORY)
    if (memoryCues.length) {
      if (!target.fields.memoryCues) {
        if (target.fields.hotCues && hotCues.length < (target.cueLimit || 0)) {
          trackConverted.push('memory-cues-to-hot-cues')
        } else {
          trackLost.push('memory-cues')
          pushIssue('warning', 'unsupported-memory-cues', `Memory cues cannot be represented by ${target.label}.`, track)
        }
      }
      if (target.memoryCueLimit != null && memoryCues.length > target.memoryCueLimit) {
        trackLost.push('memory-cue-overflow')
        pushIssue('warning', 'memory-cue-overflow', `${memoryCues.length} memory cues exceed the ${target.memoryCueLimit} supported.`, track)
      }
    }
    if (track.loops?.length && !target.fields.loops) {
      trackLost.push('loops')
      pushIssue('warning', 'unsupported-loops', `Loops cannot be represented by ${target.label}.`, track)
    }
    if ((track.beatgrid || track.bpm) && !target.fields.beatgrid) {
      trackLost.push('beatgrid')
      pushIssue('warning', 'unsupported-beatgrid', `Beatgrid/BPM cannot be represented by ${target.label}.`, track)
    }
    if (track.color && !target.fields.color) {
      trackLost.push('color-label')
      pushIssue('info', 'unsupported-color', `Track color label cannot be represented by ${target.label}.`, track)
    }
    perTrack.push({
      trackId: track.sourceId || track.id || null,
      title: track.title,
      artist: track.artist,
      converted: [...new Set(trackConverted)],
      lost: [...new Set(trackLost)],
      skipped: [...new Set(trackSkipped)],
    })
  }

  for (const [field, label] of Object.entries({
    title: 'Title', artist: 'Artist', album: 'Album', genre: 'Genre', comment: 'Comment',
    bpm: 'BPM', key: 'Key', duration: 'Duration', rating: 'Rating', color: 'Color label',
    hotCues: 'Hot cues', memoryCues: 'Memory cues', loops: 'Loops', beatgrid: 'Beatgrid',
    playlists: 'Playlists', folderHierarchy: 'Folder hierarchy',
  })) {
    if (target.fields[field]) supported.push(label)
    else lost.push(label)
  }

  const blockers = issues.filter((issue) => issue.level === 'error')
  const warnings = issues.filter((issue) => issue.level === 'warning')
  const info = issues.filter((issue) => issue.level === 'info')

  return {
    targetId,
    targetLabel: target.label,
    generatedAt: new Date().toISOString(),
    summary,
    supported,
    converted: [...new Set(perTrack.flatMap((track) => track.converted))],
    skipped: [...new Set(perTrack.flatMap((track) => track.skipped))],
    lost: [...new Set([...lost, ...perTrack.flatMap((track) => track.lost)])],
    issues,
    counts: {
      blocking: blockers.length,
      warnings: warnings.length,
      info: info.length,
      exportableTracks: (library.tracks || []).filter((track) => !track.streaming && !track.protected && !track.missing).length,
    },
    requiresConfirmation: blockers.length > 0 || warnings.some((issue) => issue.code === 'cue-overflow' || issue.code === 'memory-cue-overflow'),
    profiles: TARGET_PROFILES[targetId],
    hardwareValidation: target.hardwareValidation,
    notes: target.notes,
    options,
    perTrack,
  }
}

/** Duration formatting helpers shared by exporters. */
export function formatDuration(seconds) {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return '00:00:00'
  const hours = Math.floor(value / 3600)
  const mins = Math.floor((value % 3600) / 60)
  const secs = Math.floor(value % 60)
  return [hours, mins, secs].map((part) => String(part).padStart(2, '0')).join(':')
}

export function escapeXml(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function hexToUnit(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return { red: rgb.r / 255, green: rgb.g / 255, blue: rgb.b / 255 }
}

/** Accept "1:02:03", "02:03" and plain seconds. */
export function parseDuration(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const str = String(value).trim()
  if (/^\d+(\.\d+)?$/.test(str)) return Number(str)
  const parts = str.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}
