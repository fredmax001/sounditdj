import path from 'path'
import fs from 'fs-extra'

import { SOURCE_FORMATS, createLibrary } from '../model.js'
import { loadSeratoLibrary, parseSeratoDatabase, parseSeratoCrate } from './serato.js'
import { parseRekordboxXml } from './rekordboxXml.js'
import { parseVirtualDjXml } from './virtualdj.js'
import { parseAppleMusicXml } from './appleMusic.js'
import { loadFolderLibrary, parseCsv, parseJson, parseM3u, parseTraktorNml } from './simple.js'

export const ADAPTERS = [
  { id: SOURCE_FORMATS.SERATO, label: 'Serato DJ', formats: ['database V2', '.crate'], canImport: true, canExport: true },
  { id: SOURCE_FORMATS.REKORDBOX_XML, label: 'Rekordbox XML', formats: ['.xml'], canImport: true, canExport: true },
  { id: SOURCE_FORMATS.VIRTUALDJ, label: 'VirtualDJ XML', formats: ['.xml'], canImport: true, canExport: true },
  { id: SOURCE_FORMATS.APPLE_MUSIC, label: 'Apple Music / iTunes XML', formats: ['.xml'], canImport: true, canExport: false },
  { id: SOURCE_FORMATS.TRAKTOR, label: 'Traktor NML', formats: ['.nml'], canImport: true, canExport: false },
  { id: SOURCE_FORMATS.M3U, label: 'M3U / M3U8', formats: ['.m3u', '.m3u8'], canImport: true, canExport: true },
  { id: SOURCE_FORMATS.CSV, label: 'CSV', formats: ['.csv'], canImport: true, canExport: true },
  { id: SOURCE_FORMATS.JSON, label: 'Sound It DJ JSON', formats: ['.json'], canImport: true, canExport: true },
  { id: SOURCE_FORMATS.FOLDER, label: 'Folder scan', formats: [], canImport: true, canExport: false },
]

export function detectXmlFormat(text) {
  const sample = String(text || '').slice(0, 4096)
  if (/<DJ_PLAYLISTS\b/i.test(sample)) return SOURCE_FORMATS.REKORDBOX_XML
  if (/<VirtualDJ_Database\b/i.test(sample) || /<VirtualDJ_DataBase\b/i.test(sample)) return SOURCE_FORMATS.VIRTUALDJ
  if (/<plist\b/i.test(sample) || /<key>Tracks<\/key>/i.test(sample)) return SOURCE_FORMATS.APPLE_MUSIC
  return null
}

/**
 * Detect and parse a supported library file/folder.
 * @param {string} target path to a file or directory
 * @param {object} options { format, relink, enrichTags, readMetadata }
 */
export async function importLibraryPath(target, options = {}) {
  const absolute = path.resolve(target)
  if (!(await fs.pathExists(absolute))) {
    throw new Error(`Import path does not exist: ${absolute}`)
  }
  const stats = await fs.stat(absolute)

  if (stats.isDirectory()) {
    const isSerato = await fs.pathExists(path.join(absolute, 'database V2'))
      || await fs.pathExists(path.join(absolute, 'Subcrates'))
      || await fs.pathExists(path.join(absolute, 'SubCrates'))
      || await fs.pathExists(path.join(absolute, 'Crates'))
    if (isSerato) {
      return loadSeratoLibrary(absolute, options)
    }
    return loadFolderLibrary(absolute, options)
  }

  const extension = path.extname(absolute).toLowerCase()
  const fileName = path.basename(absolute)
  const format = options.format || detectFileFormat(absolute, fileName, extension)
  if (!format) throw new Error(`Unsupported import format: ${fileName}`)

  if (format === SOURCE_FORMATS.SERATO) {
    const buffer = await fs.readFile(absolute)
    if (fileName === 'database V2') return parseSeratoDatabase(buffer)
    const paths = parseSeratoCrate(buffer)
    const library = createLibrary(SOURCE_FORMATS.SERATO)
    library.playlists.push({
      sourceId: 'crate-playlist',
      name: path.basename(absolute, '.crate'),
      parentId: null,
      isFolder: false,
      trackIds: paths.map((_, index) => `crate-${index + 1}`),
      sourceTrackRefs: paths.map((_, index) => `crate-${index + 1}`),
      children: [],
    })
    for (const [index, filePath] of paths.entries()) {
      library.tracks.push({
        ...createLibraryTrackBase(filePath, index),
      })
    }
    return markMissingFiles(library)
  }

  if (format === SOURCE_FORMATS.FOLDER) {
    return loadFolderLibrary(absolute, options)
  }

  if (extension === '.m3u' || extension === '.m3u8') {
    return markMissingFiles(parseM3u(await fs.readFile(absolute, 'utf8'), { baseDir: path.dirname(absolute), name: path.basename(absolute, extension) }))
  }
  if (extension === '.csv') {
    return markMissingFiles(parseCsv(await fs.readFile(absolute, 'utf8'), { baseDir: path.dirname(absolute), name: path.basename(absolute, extension) }))
  }
  if (extension === '.json') {
    return markMissingFiles(parseJson(await fs.readFile(absolute, 'utf8')))
  }
  if (extension === '.nml') {
    return markMissingFiles(parseTraktorNml(await fs.readFile(absolute, 'utf8')))
  }
  if (extension === '.xml' || extension === '.plist') {
    const text = await fs.readFile(absolute, 'utf8')
    const detected = format || detectXmlFormat(text)
    if (detected === SOURCE_FORMATS.REKORDBOX_XML) return markMissingFiles(parseRekordboxXml(text))
    if (detected === SOURCE_FORMATS.VIRTUALDJ) return markMissingFiles(parseVirtualDjXml(text))
    if (detected === SOURCE_FORMATS.APPLE_MUSIC) return markMissingFiles(parseAppleMusicXml(text))
    throw new Error('XML file is not a recognised rekordbox, VirtualDJ or Apple Music export')
  }

  throw new Error(`Unsupported import format: ${fileName}`)
}

function detectFileFormat(absolute, fileName, extension) {
  if (fileName === 'database V2' || extension === '.crate') return SOURCE_FORMATS.SERATO
  if (extension === '.nml') return SOURCE_FORMATS.TRAKTOR
  if (extension === '.m3u' || extension === '.m3u8') return SOURCE_FORMATS.M3U
  if (extension === '.csv') return SOURCE_FORMATS.CSV
  if (extension === '.json') return SOURCE_FORMATS.JSON
  if (extension === '.xml' || extension === '.plist') return null
  return null
}

function createLibraryTrackBase(filePath, index) {
  return {
    sourceId: `crate-${index + 1}`,
    title: path.basename(filePath).replace(/\.[^.]+$/, ''),
    artist: null,
    album: null,
    albumArtist: null,
    genre: null,
    comment: null,
    composer: null,
    bpm: null,
    key: null,
    duration: null,
    path: filePath,
    filename: path.basename(filePath),
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
  }
}

export async function markMissingFiles(library) {
  for (const track of library.tracks || []) {
    if (!track.path || track.streaming || track.protected) continue
    if (/^[a-z]+:\/\//i.test(track.path)) continue
    try {
      track.missing = !(await fs.pathExists(track.path))
    } catch {
      track.missing = true
    }
  }
  return library
}

export async function importBuffer(buffer, fileName, options = {}) {
  const extension = path.extname(fileName || '').toLowerCase()
  const text = buffer.toString('utf8')
  if (extension === '.xml' || extension === '.plist') {
    const detected = detectXmlFormat(text)
    if (detected === SOURCE_FORMATS.REKORDBOX_XML) return markMissingFiles(parseRekordboxXml(text))
    if (detected === SOURCE_FORMATS.VIRTUALDJ) return markMissingFiles(parseVirtualDjXml(text))
    if (detected === SOURCE_FORMATS.APPLE_MUSIC) return markMissingFiles(parseAppleMusicXml(text))
    throw new Error('Unrecognised XML export')
  }
  if (extension === '.crate') {
    const tempDir = options.tempDir || null
    if (!tempDir) throw new Error('Crate import needs a temporary directory')
    const tempPath = path.join(tempDir, fileName)
    await fs.writeFile(tempPath, buffer)
    try {
      return await importLibraryPath(tempPath, options)
    } finally {
      await fs.remove(tempPath).catch(() => {})
    }
  }
  if (extension === '.m3u' || extension === '.m3u8') return markMissingFiles(parseM3u(text, options))
  if (extension === '.csv') return markMissingFiles(parseCsv(text, options))
  if (extension === '.json') return markMissingFiles(parseJson(text))
  if (extension === '.nml') return markMissingFiles(parseTraktorNml(text))
  throw new Error(`Unsupported import format: ${fileName}`)
}
