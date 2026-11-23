import express from 'express'
import fs from 'fs'
import fsExtra from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

function mimeTypeForExt(ext) {
    switch ((ext || '').toLowerCase()) {
        case '.mp3': return 'audio/mpeg'
        case '.m4a': return 'audio/mp4'
        case '.mp4': return 'video/mp4'
        case '.wav': return 'audio/wav'
        case '.flac': return 'audio/flac'
        case '.ogg': return 'audio/ogg'
        default: return 'application/octet-stream'
    }
}

// Stream a track by id. Supports Range header for seeking.
router.get('/track/:id', async (req, res) => {
    try {
        const id = req.params.id
        const db = req.app.locals.db
        const track = await db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(id, req.user.id)
        if (!track) return res.status(404).json({ error: 'Track not found' })

        let filePath = track.path
        // If path points to uploads filename (legacy), fall back to uploads dir
        if (!filePath || filePath.startsWith('/uploads') || filePath === `/uploads/tracks/${track.filename}`) {
            filePath = path.join(__dirname, '../..', 'uploads', 'tracks', track.filename)
        }

        const exists = await fsExtra.pathExists(filePath)
        if (!exists) return res.status(404).json({ error: 'File not found' })

        const stat = await fsExtra.stat(filePath)
        const total = stat.size
        const range = req.headers.range

        const ext = path.extname(filePath)
        const contentType = mimeTypeForExt(ext)

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : total - 1
            if (isNaN(start) || isNaN(end) || start > end || end >= total) {
                return res.status(416).send('Requested Range Not Satisfiable')
            }

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${total}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': (end - start) + 1,
                'Content-Type': contentType,
            })

            const stream = fs.createReadStream(filePath, { start, end })
            stream.pipe(res)
            stream.on('error', (err) => {
                console.error('Stream error:', err)
                res.destroy()
            })
        } else {
            res.writeHead(200, {
                'Content-Length': total,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
            })
            const stream = fs.createReadStream(filePath)
            stream.pipe(res)
            stream.on('error', (err) => {
                console.error('Stream error:', err)
                res.destroy()
            })
        }
    } catch (err) {
        console.error('Media stream error:', err)
        res.status(500).json({ error: 'Failed to stream media' })
    }
})

export default router
