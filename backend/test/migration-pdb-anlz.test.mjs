import assert from 'assert'
import {
  buildPdb,
  parsePdb,
  preparePdb,
  validatePdb,
  TABLE_TYPES,
} from '../src/library/pioneer/pdb.js'
import {
  analysisPathForMediaPath,
  buildAnlzDat,
  buildAnlzExt,
  readAnlzDetails,
  validateAnlz,
} from '../src/library/pioneer/anlz.js'
import { createLibrary, createPlaylist, createTrack } from '../src/library/model.js'

const library = createLibrary('test', {
  tracks: [
    createTrack({
      sourceId: 't1',
      title: 'Track One',
      artist: 'Artist',
      bpm: 128,
      duration: 240,
      path: '/music/track-one.mp3',
      filename: 'track-one.mp3',
      key: '8A',
      color: '#00FF00',
      cues: [
        { kind: 'hot', slot: 1, position: 12.5, name: 'Intro', color: '#FF0000' },
        { kind: 'memory', position: 0.5, name: 'Start' },
      ],
      loops: [{ slot: 2, start: 32, end: 36, name: 'Loop' }],
      beatgrid: { bpm: 128, anchor: 0.1 },
    }),
  ],
  playlists: [createPlaylist({ sourceId: 'p1', name: 'Set', trackIds: ['t1'] })],
})

const prepared = preparePdb(library, {
  mediaPathForTrack: () => '/Contents/Artist/Track One.mp3',
  analysisPathForTrack: () => '/PIONEER/USBANLZ/P001/00000001/ANLZ0000.DAT',
})
const pdb = buildPdb(prepared).buffer
const validation = validatePdb(pdb)
assert.ok(validation.ok, `PDB invalid: ${validation.issues.join('; ')}`)
const parsed = parsePdb(pdb)
assert.equal((parsed.rows[TABLE_TYPES.TRACKS] || []).length, 1)
assert.equal((parsed.rows[TABLE_TYPES.PLAYLIST_TREE] || []).length, 1)
assert.equal((parsed.rows[TABLE_TYPES.PLAYLIST_ENTRIES] || []).length, 1)
assert.equal(parsed.rows[TABLE_TYPES.TRACKS][0].filePath, '/Contents/Artist/Track One.mp3')
assert.equal(parsed.rows[TABLE_TYPES.TRACKS][0].bpm, 128)

const dat = buildAnlzDat(library.tracks[0], '/Contents/Artist/Track One.mp3')
const ext = buildAnlzExt(library.tracks[0], '/Contents/Artist/Track One.mp3')
const anlzValidation = validateAnlz(dat, ext)
assert.ok(anlzValidation.ok, `ANLZ invalid: ${anlzValidation.issues.join('; ')}`)
const details = readAnlzDetails(ext)
assert.ok(details.extendedCues.length >= 1, 'expected extended cues')
assert.ok(details.tags.some((tag) => tag.tag === 'PQT2'), 'expected extended beatgrid tag')
const datDetails = readAnlzDetails(dat)
assert.ok(datDetails.beatgrid.length > 0, 'expected beatgrid in DAT')
assert.ok(analysisPathForMediaPath('/Contents/Artist/Track One.mp3').startsWith('/PIONEER/USBANLZ/'))

console.log('migration-pdb-anlz.test: ok')
