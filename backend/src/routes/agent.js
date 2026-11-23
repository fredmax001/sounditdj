import express from 'express'

import kimiAgent from '../services/kimiAgent/AgentCore.js'
import {
  ValidationError,
  assertArray,
  assertEnum,
  assertOptionalString,
  assertString,
  assertUUID,
  sendValidationError,
} from '../security/validation.js'

const router = express.Router()

let agentInitialized = false

async function ensureAgent(db) {
  if (!agentInitialized) {
    kimiAgent.setDatabase(db)
    await kimiAgent.initialize()
    agentInitialized = true
  }
}

async function getOwnedTrack(db, userId, trackId) {
  return db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(trackId, userId)
}

router.use((req, res, next) => {
  req.db = req.app.locals.db
  next()
})

router.post('/analyze-mix', async (req, res) => {
  try {
    await ensureAgent(req.db)

    const trackIds = assertArray(req.body.trackIds, 'trackIds', { min: 1, max: 50 })
    const analysisType = assertEnum(req.body.analysisType || 'full', 'analysisType', ['quick', 'full'])

    const results = []

    for (const trackId of trackIds) {
      assertUUID(trackId, 'trackId')

      const track = await getOwnedTrack(req.db, req.user.id, trackId)
      if (!track) {
        results.push({ trackId, error: 'Track not found' })
        continue
      }

      const result = await kimiAgent.processTask({
        type: 'analyze_mix_track',
        trackId,
        audioPath: track.path,
        options: { analysisType },
      })

      results.push(result)
    }

    let mixAnalysis = null
    if (results.length > 1) {
      const trackData = results.filter((result) => !result.error)
      try {
        const chatResponse = await kimiAgent.chat(
          `Analyze these ${trackData.length} tracks for DJ mix compatibility. Suggest transition order, key compatibility, and energy flow.`,
          null,
          []
        )
        mixAnalysis = chatResponse.response
      } catch {
        mixAnalysis = 'Mix analysis not available'
      }
    }

    res.json({
      success: true,
      tracksAnalyzed: results.length,
      trackDetails: results,
      mixInsights: mixAnalysis,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Agent analysis failed:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/identify/:trackId', async (req, res) => {
  try {
    await ensureAgent(req.db)

    assertUUID(req.params.trackId, 'trackId')
    const trackId = req.params.trackId
    const track = await getOwnedTrack(req.db, req.user.id, trackId)

    if (!track) {
      return res.status(404).json({ error: 'Track not found' })
    }

    const hints = assertOptionalString(req.body.hints, 'hints', { max: 500 })

    const identification = await kimiAgent.processTask({
      type: 'identify',
      trackId,
      audioPath: track.path,
      userPrompt: hints || '',
    })

    res.json(identification)
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Identify failed:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/generate-cover/:trackId', async (req, res) => {
  try {
    await ensureAgent(req.db)

    assertUUID(req.params.trackId, 'trackId')

    const trackId = req.params.trackId
    const style = assertEnum(req.body.style || 'modern', 'style', ['modern', 'retro', 'minimal', 'vintage'])
    const vibe = assertEnum(req.body.vibe || 'energetic', 'vibe', ['energetic', 'chill', 'dark', 'uplifting'])

    const track = await getOwnedTrack(req.db, req.user.id, trackId)
    if (!track) {
      return res.status(404).json({ error: 'Track not found' })
    }

    const coverResult = await kimiAgent.processTask({
      type: 'generate_cover',
      trackId,
      audioPath: track.path,
      options: { style, vibe },
    })

    res.json({
      success: true,
      trackId,
      prompt: coverResult.coverArt?.prompt || coverResult.prompt,
      metadata: {
        style,
        vibe,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Generate cover failed:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/convert/:trackId', async (req, res) => {
  try {
    await ensureAgent(req.db)

    assertUUID(req.params.trackId, 'trackId')

    const trackId = req.params.trackId
    const format = assertEnum(req.body.format || 'mp3', 'format', ['mp3', 'wav', 'flac', 'aac'])
    const quality = assertString(req.body.quality || '320k', 'quality', { min: 2, max: 10 })

    const track = await getOwnedTrack(req.db, req.user.id, trackId)
    if (!track) {
      return res.status(404).json({ error: 'Track not found' })
    }

    const conversion = await kimiAgent.processTask({
      type: 'convert',
      trackId,
      audioPath: track.path,
      params: { outputFormat: format, quality },
    })

    res.json(conversion)
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Convert failed:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/chat', async (req, res) => {
  try {
    await ensureAgent(req.db)

    const message = assertString(req.body.message, 'message', { min: 1, max: 2000 })
    const trackId = req.body.trackId || null
    const context = Array.isArray(req.body.context) ? req.body.context.slice(-20) : []

    if (trackId) {
      assertUUID(trackId, 'trackId')
      const track = await getOwnedTrack(req.db, req.user.id, trackId)
      if (!track) {
        return res.status(404).json({ error: 'Track not found' })
      }
    }

    const response = await kimiAgent.chat(message, trackId, context)

    const newContext = [...context, { role: 'user', content: message }, { role: 'assistant', content: response.response }]

    res.json({
      response: response.response,
      usage: response.usage,
      context: newContext,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Chat failed:', error)
    res.status(500).json({ error: error.message })
  }
})

router.get('/memory/:trackId', async (req, res) => {
  try {
    await ensureAgent(req.db)

    assertUUID(req.params.trackId, 'trackId')
    const trackId = req.params.trackId

    const track = await getOwnedTrack(req.db, req.user.id, trackId)
    if (!track) {
      return res.status(404).json({ error: 'Track not found' })
    }

    const history = await kimiAgent.getMemory(trackId)
    res.json({
      trackId,
      history: history.map((entry) => ({
        ...entry,
        result: entry.result ? JSON.parse(entry.result) : null,
      })),
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Get memory failed:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/quick-analyze/:trackId', async (req, res) => {
  try {
    await ensureAgent(req.db)

    assertUUID(req.params.trackId, 'trackId')
    const trackId = req.params.trackId
    const track = await getOwnedTrack(req.db, req.user.id, trackId)

    if (!track) {
      return res.status(404).json({ error: 'Track not found' })
    }

    const [analysis, identification, similar] = await Promise.all([
      kimiAgent.processTask({
        type: 'analyze',
        trackId,
        audioPath: track.path,
      }),
      kimiAgent.processTask({
        type: 'identify',
        trackId,
        audioPath: track.path,
      }),
      kimiAgent.processTask({
        type: 'search_similar',
        trackId,
        audioPath: track.path,
      }),
    ])

    res.json({
      success: true,
      trackId,
      analysis,
      identification,
      similarTracks: similar.similarTracks || [],
      processedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Quick analyze failed:', error)
    res.status(500).json({ error: error.message })
  }
})

router.get('/status', async (req, res) => {
  res.json({
    initialized: agentInitialized,
    model: process.env.KIMI_MODEL || 'kimi-k2.5',
    timestamp: new Date().toISOString(),
  })
})

export default router
