import assert from 'assert'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import { createLibrary, createPlaylist, createTrack } from '../src/library/model.js'
import { exportLibraryToUsb, planUsbExport } from '../src/library/pioneer/usbExport.js'
import { parsePdb, TABLE_TYPES } from '../src/library/pioneer/pdb.js'
import { readAnlzDetails } from '../src/library/pioneer/anlz.js'

const tmp = path.join(os.tmpdir(), `sounditdj-migration-test-${Date.now()}`)
const sourceDir = path.join(tmp, 'source')
const deviceDir = path.join(tmp, 'usb')
await fs.ensureDir(sourceDir)
await fs.ensureDir(deviceDir)

const audioA = path.join(sourceDir, 'a.mp3')
const audioB = path.join(sourceDir, 'b.wav')
await fs.writeFile(audioA, Buffer.alloc(1024, 1))
await fs.writeFile(audioB, Buffer.alloc(2048, 2))

const library = createLibrary('test', {
  tracks: [
    createTrack({
      sourceId: 'a',
      title: 'Alpha',
      artist: 'DJ Test',
      bpm: 120,
      duration: 180,
      path: audioA,
      filename: 'a.mp3',
      cues: [{ kind: 'hot', slot: 1, position: 10, name: 'Cue 1' }],
      loops: [{ slot: 2, start: 20, end: 24 }],
      beatgrid: { bpm: 120, anchor: 0.1 },
    }),
    createTrack({
      sourceId: 'b',
      title: 'Beta',
      artist: 'DJ Test',
      bpm: 124,
      duration: 200,
      path: audioB,
      filename: 'b.wav',
    }),
    createTrack({
      sourceId: 'missing',
      title: 'Missing',
      path: path.join(sourceDir, 'missing.mp3'),
      missing: true,
    }),
  ],
  playlists: [createPlaylist({ sourceId: 'pl', name: 'Playlist', trackIds: ['a', 'b', 'missing'] })],
})

const plan = await planUsbExport(library, deviceDir, { profile: 'rekordbox-usb' })
assert.equal(plan.counts.ready, 2)
assert.equal(plan.counts.missing, 1)

const report = await exportLibraryToUsb(library, deviceDir, { profile: 'rekordbox-usb' })
assert.ok(report.ok, `Export failed: ${JSON.stringify(report.errors)}`)
assert.equal(report.counts.tracks, 2)

const pdb = await fs.readFile(path.join(deviceDir, 'PIONEER', 'rekordbox', 'export.pdb'))
const parsed = parsePdb(pdb)
assert.equal((parsed.rows[TABLE_TYPES.TRACKS] || []).length, 2)
assert.equal((parsed.rows[TABLE_TYPES.PLAYLIST_ENTRIES] || []).length, 2)

const track = (parsed.rows[TABLE_TYPES.TRACKS] || [])[0]
assert.ok(track.filePath.startsWith('/Contents/'))
assert.ok(track.analysisPath.startsWith('/PIONEER/USBANLZ/'))
const datPath = path.join(deviceDir, track.analysisPath.replace(/^\//, ''))
const extPath = datPath.replace(/\.DAT$/i, '.EXT')
const datDetails = readAnlzDetails(await fs.readFile(datPath))
const extDetails = readAnlzDetails(await fs.readFile(extPath))
assert.ok(datDetails.beatgrid.length > 0, 'expected beatgrid in DAT')
assert.ok(extDetails.ok, 'EXT should parse')

await fs.remove(tmp)
console.log('migration-usb-export.test: ok')
