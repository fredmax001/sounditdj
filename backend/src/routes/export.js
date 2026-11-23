import express from 'express'

import { ValidationError, assertEnum, assertUUID, sendValidationError } from '../security/validation.js'

const router = express.Router()

router.get('/playlist/:format', async (req, res) => {
  try {
    const format = assertEnum(req.params.format, 'format', ['m3u', 'csv', 'xml'])
    assertUUID(req.query.playlistId, 'playlistId')

    const playlistId = req.query.playlistId
    const db = req.app.locals.db
    const userId = req.user.id

    const playlist = await db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId)
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' })
    }

    const tracks = await db
      .prepare(
        `SELECT t.*
         FROM tracks t
         JOIN playlist_tracks pt ON t.id = pt.track_id
         WHERE pt.playlist_id = ? AND t.user_id = ?
         ORDER BY pt.position`
      )
      .all(playlistId, userId)

    // Fetch cue points for all tracks in one query
    const trackIds = tracks.map(t => t.id)
    let cuePointsMap = new Map()
    if (trackIds.length > 0) {
      const placeholders = trackIds.map(() => '?').join(',')
      const cuePoints = await db
        .prepare(`SELECT * FROM cue_points WHERE track_id IN (${placeholders}) ORDER BY position`)
        .all(...trackIds)
      for (const cp of cuePoints) {
        if (!cuePointsMap.has(cp.track_id)) cuePointsMap.set(cp.track_id, [])
        cuePointsMap.get(cp.track_id).push(cp)
      }
    }

    let content = ''
    let contentType = ''
    let fileExtension = ''

    switch (format) {
      case 'm3u':
        content = generateM3U(playlist, tracks)
        contentType = 'audio/x-mpegurl'
        fileExtension = 'm3u'
        break
      case 'csv':
        content = generateCSV(tracks)
        contentType = 'text/csv'
        fileExtension = 'csv'
        break
      case 'xml':
        content = generateXML(playlist, tracks, cuePointsMap)
        contentType = 'application/xml'
        fileExtension = 'xml'
        break
      default:
        break
    }

    // Preserve spaces and most characters; only strip truly unsafe filesystem chars
    const safeName = playlist.name
      .replace(/[<>:"\\|?*]/g, '')   // Windows forbidden chars
      .replace(/\//g, '_')             // macOS/Linux path separator
      .replace(/[\x00-\x1f]/g, '')      // control chars
      .trim() || 'playlist'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.${fileExtension}"`)
    res.send(content)
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Export error:', error)
    res.status(500).json({ error: 'Failed to export playlist' })
  }
})

function generateM3U(playlist, tracks) {
  let content = '#EXTM3U\n'
  content += `#PLAYLIST:${playlist.name}\n`

  tracks.forEach((track) => {
    const duration = track.duration ? Math.round(track.duration) : -1
    const title = track.title || 'Unknown Title'
    const artist = track.artist || 'Unknown Artist'

    content += `#EXTINF:${duration},${artist} - ${title}\n`
    content += `${track.path || `/uploads/tracks/${track.filename}`}\n`
  })

  return content
}

function generateCSV(tracks) {
  let content = 'Position,Title,Artist,Album,BPM,Key,Duration,Filename\n'

  tracks.forEach((track, index) => {
    const row = [
      index + 1,
      `"${(track.title || '').replace(/"/g, '""')}"`,
      `"${(track.artist || '').replace(/"/g, '""')}"`,
      `"${(track.album || '').replace(/"/g, '""')}"`,
      track.bpm || '',
      track.key || '',
      track.duration || '',
      track.filename,
    ].join(',')

    content += `${row}\n`
  })

  return content
}

function generateXML(playlist, tracks, cuePointsMap) {
  let content = '<?xml version="1.0" encoding="UTF-8"?>\n'
  content += '<DJ_PLAYLISTS Version="1.0.0">\n'
  content += '  <PRODUCT Name="rekordbox" Version="6.0.0" Company="Pioneer DJ"/>\n'
  content += `  <COLLECTION Entries="${tracks.length}">\n`

  tracks.forEach((track, index) => {
    const trackNum = index + 1
    content += `    <TRACK TrackID="${trackNum}" Name="${escapeXml(track.title || '')}" Artist="${escapeXml(track.artist || '')}" Album="${escapeXml(track.album || '')}" TotalTime="${formatDuration(track.duration)}"\n`
    if (track.bpm) {
      content += `           Tempo="${Math.round(track.bpm)}"\n`
    }
    if (track.key) {
      content += `           Tonality="${track.key}"\n`
    }
    let locationPath = track.path || `/uploads/tracks/${track.filename}`
    if (locationPath) {
      if (!locationPath.startsWith('/')) {
        locationPath = '/' + locationPath
      }
      locationPath = encodeURI(locationPath).replace(/#/g, '%23').replace(/\?/g, '%3F')
    }
    content += `           Location="file://localhost${locationPath}">\n`

    // Add cue points / memory cues
    const cues = cuePointsMap.get(track.id) || []
    if (cues.length > 0) {
      cues.forEach((cue, cueIdx) => {
        const cueNum = cueIdx + 1
        const time = formatCueTime(cue.position)
        content += `      <POSITION_MARK Name="${escapeXml(cue.name || `Cue ${cueNum}`)}" Type="0" Start="${time}" Num="${cueNum}" Red="${hexToRed(cue.color)}" Green="${hexToGreen(cue.color)}" Blue="${hexToBlue(cue.color)}"/>\n`
      })
    }

    content += `    </TRACK>\n`
  })

  content += '  </COLLECTION>\n'
  content += '  <PLAYLISTS>\n'
  content += '    <NODE Type="0" Name="ROOT" Count="1">\n'
  content += `      <NODE Name="${escapeXml(playlist.name)}" Type="1" KeyType="0" Entries="${tracks.length}">\n`

  tracks.forEach((track, index) => {
    content += `        <TRACK Key="${index + 1}"/>\n`
  })

  content += '      </NODE>\n'
  content += '    </NODE>\n'
  content += '  </PLAYLISTS>\n'
  content += '</DJ_PLAYLISTS>\n'

  return content
}

function escapeXml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDuration(seconds) {
  if (!seconds) return '00:00:00'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatCueTime(seconds) {
  if (!seconds) return '0.000'
  return seconds.toFixed(3)
}

function hexToRed(hex) {
  if (!hex || typeof hex !== 'string' || hex.length < 7) return 0
  return parseInt(hex.slice(1, 3), 16) / 255
}

function hexToGreen(hex) {
  if (!hex || typeof hex !== 'string' || hex.length < 7) return 0
  return parseInt(hex.slice(3, 5), 16) / 255
}

function hexToBlue(hex) {
  if (!hex || typeof hex !== 'string' || hex.length < 7) return 0
  return parseInt(hex.slice(5, 7), 16) / 255
}

export default router
