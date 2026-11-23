import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFilePromise = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class KimiAgent {
  constructor() {
    const apiKey = process.env.KIMI_API_KEY || process.env.OPENAI_API_KEY;
    this.client = apiKey
      ? new OpenAI({
        apiKey,
        baseURL: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
      })
      : null;
    this.aiEnabled = Boolean(apiKey);

    this.model = process.env.KIMI_MODEL || 'kimi-k2.5';
    this.projectContext = null;
    this.tools = new Map();
    this.memory = new Map();
    this.db = null;
  }

  // Set database connection
  setDatabase(db) {
    this.db = db;
  }

  // Initialize agent with complete project understanding
  async initialize() {
    await this.loadProjectContext();
    this.registerTools();
    await this.ensureTablesExist();
    if (!this.aiEnabled) {
      console.warn('⚠️ Kimi Agent AI features disabled: set KIMI_API_KEY or OPENAI_API_KEY');
    }
    console.log('🤖 Kimi Agent initialized with project context');
  }

  // Ensure database tables exist
  async ensureTablesExist() {
    if (!this.db) return;

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT NOT NULL,
        action TEXT NOT NULL,
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        track_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Load complete project knowledge
  async loadProjectContext() {
    this.projectContext = {
      project: {
        name: "FMX DJ Platform",
        type: "Professional audio library & analyzer",
        stack: ["Node.js", "Express", "React", "Vite", "Electron", "SQLite"],
        features: [
          "Audio upload (MP3, WAV, AIFF, FLAC)",
          "BPM/Key analysis",
          "Waveform visualization",
          "Track library management",
          "AI-powered track identification",
          "Cover art generation",
          "Media conversion",
          "USB Export for CDJs"
        ]
      },
      audioFormats: {
        supported: ['mp3', 'wav', 'aiff', 'flac', 'm4a', 'aac'],
        maxSize: '50MB',
        analysisFeatures: ['bpm', 'key', 'loudness', 'duration', 'waveform']
      },
      database: {
        schema: "tracks(id, filename, originalName, duration, bpm, key, loudness, waveformData, artist, title, coverArt, analyzedAt)",
        relationships: "One track has many analysis_results"
      },
      fileStructure: {
        uploads: "./uploads/",
        processed: "./processed/",
        covers: "./covers/",
        temp: "./temp/"
      },
      apiEndpoints: {
        upload: "POST /api/library/upload",
        analyze: "POST /api/analyze/:id",
        agent: "POST /api/agent/process",
        convert: "POST /api/convert",
        cover: "POST /api/cover/generate"
      }
    };

    await this.persistContext();
  }

  registerTools() {
    this.tools.set('analyze_audio', this.analyzeAudioTool.bind(this));
    this.tools.set('analyze_mix_track', this.analyzeAudioTool.bind(this));
    this.tools.set('identify_track', this.identifyTrackTool.bind(this));
    this.tools.set('generate_cover', this.generateCoverTool.bind(this));
    this.tools.set('convert_media', this.convertMediaTool.bind(this));
    this.tools.set('write_metadata', this.writeMetadataTool.bind(this));
    this.tools.set('query_library', this.queryLibraryTool.bind(this));
    this.tools.set('search_similar', this.searchSimilarTool.bind(this));
  }

  // Main entry point
  async processTask(task) {
    const { type, trackId, audioPath, userPrompt, options = {} } = task;

    console.log(`🎯 Agent processing: ${type} for track ${trackId}`);

    const systemPrompt = this.buildSystemPrompt();
    const plan = await this.createExecutionPlan(type, userPrompt, audioPath);
    const results = await this.executePlan(plan, trackId, audioPath, options);
    await this.storeMemory(trackId, type, results);

    return results;
  }

  buildSystemPrompt() {
    return `You are an expert DJ and audio engineer AI agent embedded in a professional DJ platform called FMX DJ.
    
PROJECT CONTEXT:
${JSON.stringify(this.projectContext, null, 2)}

YOUR CAPABILITIES:
1. Audio Analysis: Extract BPM, key, energy levels, identify segments
2. Track Identification: Recognize songs, artists, remixes from audio characteristics
3. Cover Art: Generate professional DJ-style cover images from audio vibes
4. Media Conversion: Convert between formats, extract audio from video
5. Metadata Management: Write ID3 tags, organize library
6. Mix Analysis: Understand transitions, suggest track order
7. DJ Intelligence: Recommend compatible tracks, create playlists, analyze energy flow

When processing audio:
- Always reference the actual file system paths
- Use FFmpeg for reliable audio processing
- Store results in the SQLite database via the provided tools
- Generate human-readable descriptions for DJs
- Consider harmonic mixing principles (Camelot wheel)
- Analyze energy levels for set programming

Respond with structured JSON containing your analysis and recommendations.`;
  }

  async createExecutionPlan(taskType, userPrompt, audioPath) {
    if (!this.aiEnabled || !this.client) {
      return {
        steps: [{ tool: 'analyze_audio', params: {} }],
        goal: 'Analyze audio file',
      };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.buildSystemPrompt() },
          {
            role: 'user', content: `Create execution plan for task: ${taskType}
User request: ${userPrompt || 'Auto-analyze'}
Audio file: ${audioPath}

Available tools: ${Array.from(this.tools.keys()).join(', ')}

Return JSON plan with steps and tool calls needed. Format: {"steps": [{"tool": "tool_name", "params": {}}], "goal": "description"}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error creating execution plan:', error);
      // Return default plan
      return {
        steps: [{ tool: 'analyze_audio', params: {} }],
        goal: 'Analyze audio file'
      };
    }
  }

  async executePlan(plan, trackId, audioPath, options) {
    const results = [];

    for (const step of plan.steps || []) {
      const tool = this.tools.get(step.tool);
      if (!tool) {
        console.warn(`Unknown tool: ${step.tool}`);
        continue;
      }

      console.log(`🔧 Executing: ${step.tool}`);
      try {
        const result = await tool({
          trackId,
          audioPath,
          params: step.params || {},
          options
        });
        results.push({ step: step.tool, result, success: true });
      } catch (error) {
        console.error(`Tool ${step.tool} failed:`, error);
        results.push({ step: step.tool, error: error.message, success: false });
      }
    }

    return this.synthesizeResults(results, plan.goal);
  }

  synthesizeResults(results, goal) {
    return {
      success: results.some(r => r.success),
      goal,
      trackId: results.find(r => r.result?.trackId)?.result?.trackId,
      analysis: results.find(r => r.step === 'analyze_audio')?.result,
      identification: results.find(r => r.step === 'identify_track')?.result,
      coverArt: results.find(r => r.step === 'generate_cover')?.result,
      metadata: results.find(r => r.step === 'write_metadata')?.result,
      conversion: results.find(r => r.step === 'convert_media')?.result,
      completedAt: new Date().toISOString()
    };
  }

  // Tool Implementations

  async analyzeAudioTool({ trackId, audioPath, params }) {
    // Use FFprobe to extract audio features
    try {
      const { stdout: durationStr } = await execFilePromise('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        audioPath
      ]);
      const duration = parseFloat(durationStr.trim());

      // Get loudness info or other stream properties if needed safely
      // Note: FFprobe handles args via the array, preventing shell injection

      return {
        trackId,
        duration: duration || 0,
        format: path.extname(audioPath).slice(1),
        analyzedAt: new Date().toISOString()
      };
    } catch (error) {
      return { trackId, error: error.message };
    }
  }

  async identifyTrackTool({ trackId, audioPath, params }) {
    try {
      const stats = await fs.stat(audioPath);

      if (!this.aiEnabled || !this.client) {
        return {
          genre: 'Unknown',
          subgenre: 'Unknown',
          era: 'Unknown',
          mood: 'Neutral',
          energy: 50,
          suggestedTitle: path.basename(audioPath, path.extname(audioPath)),
          confidence: 0,
        };
      }

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a music identification expert. Analyze track metadata and file info to suggest identification.' },
          {
            role: 'user', content: `Analyze this audio file and identify:
1. Likely genre and subgenre
2. Estimated era/decade
3. Possible mood/energy level
4. Suggested track title format
5. Confidence level (0-100)

File info:
- Name: ${path.basename(audioPath)}
- Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB
- Modified: ${stats.mtime}

Return JSON with: {genre, subgenre, era, mood, energy, suggestedTitle, confidence}` }
        ],
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      return { trackId, error: error.message };
    }
  }

  async generateCoverTool({ trackId, audioPath, params, options }) {
    try {
      const track = await this.getTrackAnalysis(trackId);

      if (!this.aiEnabled || !this.client) {
        return {
          trackId,
          prompt: `Create modern DJ cover art for ${track?.title || path.basename(audioPath)} with ${options.vibe || 'energetic'} mood.`,
          style: options.style || 'dj-release',
          vibe: options.vibe || 'energetic',
          dimensions: '1400x1400',
          format: 'jpg',
        };
      }

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'Generate DJ-style cover art prompts based on audio characteristics.' },
          {
            role: 'user', content: `Create a cover art generation prompt for:
Genre: ${track?.genre || 'Electronic/Dance'}
BPM: ${track?.bpm || 'Unknown'}
Key: ${track?.key || 'Unknown'}
Artist: ${track?.artist || 'Unknown'}
Title: ${track?.title || path.basename(audioPath, path.extname(audioPath))}
Vibe: ${options.vibe || 'Professional DJ release'}
Style: ${options.style || 'modern'}

Generate a detailed prompt for an image generation model (DALL-E, Midjourney, or Stable Diffusion). Include visual style, color palette, composition.` }
        ]
      });

      const imagePrompt = response.choices[0].message.content;

      return {
        trackId,
        prompt: imagePrompt,
        style: options.style || 'dj-release',
        vibe: options.vibe || 'energetic',
        dimensions: '1400x1400',
        format: 'jpg'
      };
    } catch (error) {
      return { trackId, error: error.message };
    }
  }

  async convertMediaTool({ trackId, audioPath, params }) {
    const { outputFormat = 'mp3', quality = '320k' } = params;
    const outputPath = audioPath.replace(path.extname(audioPath), `.${outputFormat}`);

    try {
      // Use FFmpeg directly via execFile for safety
      const args = [
        '-i', audioPath,
        '-ar', '44100',
        '-b:a', quality,
        '-y', outputPath
      ];

      await execFilePromise('ffmpeg', args);

      return {
        trackId,
        originalPath: audioPath,
        convertedPath: outputPath,
        format: outputFormat,
        quality,
        success: true
      };
    } catch (error) {
      return { trackId, error: error.message, success: false };
    }
  }

  async writeMetadataTool({ trackId, params }) {
    // This would use node-id3 for actual ID3 writing
    // For now, just return the metadata structure
    return {
      trackId,
      tags: {
        title: params.title,
        artist: params.artist,
        album: params.album,
        genre: params.genre,
        bpm: params.bpm,
        key: params.key,
        aiGenerated: true
      },
      success: true
    };
  }

  async queryLibraryTool({ params }) {
    if (!this.db) return { error: 'Database not available' };

    try {
      const query = `%${params.query}%`;
      const tracks = await this.db.prepare(
        `SELECT * FROM tracks 
         WHERE title LIKE ? OR artist LIKE ? OR genre LIKE ?
         LIMIT 10`
      ).all(query, query, query);

      return { count: tracks.length, tracks };
    } catch (error) {
      return { error: error.message };
    }
  }

  async searchSimilarTool({ trackId, params }) {
    if (!this.db) return { error: 'Database not available' };

    try {
      const track = await this.db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId);
      if (!track) return { error: 'Track not found' };

      // Find tracks with similar BPM and key
      const similar = await this.db.prepare(
        `SELECT * FROM tracks 
         WHERE id != ? 
         AND user_id = ?
         AND bpm BETWEEN ? AND ?
         LIMIT 5`
      ).all(trackId, track.user_id, (track.bpm || 128) - 5, (track.bpm || 128) + 5);

      return { referenceTrack: trackId, similarTracks: similar };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Memory management
  async persistContext() {
    if (!this.db) return;

    try {
      await this.db.prepare(
        `INSERT OR REPLACE INTO agent_memory (key, value, updated_at) 
         VALUES (?, ?, ?)`
      ).run('project_context', JSON.stringify(this.projectContext), new Date().toISOString());
    } catch (error) {
      console.error('Failed to persist context:', error);
    }
  }

  async storeMemory(trackId, action, data) {
    this.memory.set(`${trackId}:${action}`, {
      timestamp: Date.now(),
      data
    });

    if (!this.db) return;

    try {
      await this.db.prepare(
        `INSERT INTO agent_history (track_id, action, result, created_at)
         VALUES (?, ?, ?, ?)`
      ).run(trackId, action, JSON.stringify(data), new Date().toISOString());
    } catch (error) {
      console.error('Failed to store memory:', error);
    }
  }

  async getMemory(trackId) {
    if (!this.db) return [];

    try {
      return await this.db.prepare(
        `SELECT * FROM agent_history WHERE track_id = ? ORDER BY created_at DESC`
      ).all(trackId);
    } catch (error) {
      return [];
    }
  }

  async getTrackAnalysis(trackId) {
    if (!this.db) return null;
    return await this.db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId);
  }

  // Chat interface
  async chat(message, trackId = null, context = []) {
    if (!this.aiEnabled || !this.client) {
      return {
        response: 'Agent AI is disabled. Set KIMI_API_KEY or OPENAI_API_KEY to enable chat features.',
        usage: null,
      };
    }

    let trackContext = '';
    if (trackId && this.db) {
      const track = await this.db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId);
      if (track) {
        trackContext = `Current track: ${track.title} by ${track.artist}, BPM: ${track.bpm}, Key: ${track.key}`;
      }
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: this.buildSystemPrompt() + '\n' + trackContext },
        ...context.map(c => ({ role: c.role, content: c.content })),
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return {
      response: response.choices[0].message.content,
      usage: response.usage
    };
  }
}

// Export singleton instance
export default new KimiAgent();
