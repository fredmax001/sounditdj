# RICKS DJ - Deployment Guide

## Project Overview

RICKS DJ is a professional DJ Library & Mix Intelligence Platform built with:
- **Frontend**: React 18 + Vite + Tailwind CSS + Framer Motion
- **Backend**: Node.js + Express + SQLite
- **Desktop**: Electron wrapper for Windows, macOS, and Linux

## File Structure

```
ricks-dj/
├── frontend/              # React web application
│   ├── src/
│   │   ├── components/    # Navigation, MiniPlayer
│   │   ├── pages/         # Home, Library, Analyzer, Visualizer, etc.
│   │   ├── store/         # Zustand state management
│   │   └── styles/        # Global CSS styles
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── postcss.config.js
├── backend/               # Node.js API server
│   ├── src/
│   │   ├── routes/        # API routes (auth, library, playlist, etc.)
│   │   └── index.js       # Server entry point
│   ├── database/          # SQLite database
│   ├── uploads/           # Uploaded files
│   ├── package.json
│   └── .env.example
├── electron/              # Desktop application
│   ├── main.js            # Main process
│   ├── preload.js         # Preload script
│   └── package.json
├── package.json           # Root package.json
├── README.md              # Documentation
├── LICENSE                # MIT License
└── .gitignore
```

## Quick Start

### 1. Install Dependencies

```bash
cd /mnt/okcomputer/output/ricks-dj
npm run install:all
```

This will install dependencies for root, frontend, backend, and electron.

### 2. Start Development Servers

**Option A: Run web app (frontend + backend)**
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

Access the web app at: http://localhost:5173

**Option B: Run desktop app**
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend

# Terminal 3 - Electron
npm run electron
```

## Features Implemented

### Core Features
1. **DJ Library Manager**
   - Upload audio files (MP3, WAV, FLAC, AAC)
   - Extract metadata (title, artist, album, BPM, key, artwork)
   - Search, sort, and filter tracks
   - Edit track metadata
   - Create and manage playlists

2. **AI Mix Analyzer**
   - Upload DJ mixes
   - AI-powered track detection
   - Timestamp generation
   - BPM and key detection
   - Export tracklists (TXT, CSV)

3. **Visualizer Creator**
   - Multiple visualization types (spectrum, waveform, particles, bars, circular)
   - Real-time preview
   - Custom colors and sensitivity
   - Export as MP4 video

4. **Audio Converter**
   - Convert between formats (MP3, WAV, FLAC, AAC)
   - Batch processing
   - Quality settings

5. **Cover Art Creator**
   - Multiple templates (album cover, YouTube thumbnail, Instagram)
   - Text overlays
   - Gradient backgrounds
   - Export as PNG/JPG

6. **USB Export**
   - Export playlists to USB drives
   - Support for Pioneer CDJ, Denon DJ
   - Multiple export formats (M3U, CSV, XML)

7. **Settings**
   - Account management
   - Library preferences
   - Notification settings
   - Appearance customization
   - Storage management

## API Endpoints

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Library
- `POST /api/library/upload`
- `GET /api/library/list`
- `PUT /api/library/update/:id`
- `DELETE /api/library/:id`

### Playlists
- `POST /api/playlist/create`
- `GET /api/playlist/list`
- `GET /api/playlist/:id`
- `PUT /api/playlist/update`
- `DELETE /api/playlist/delete/:id`

### Mix Analyzer
- `POST /api/analyze`
- `GET /api/analyze/status/:jobId`
- `GET /api/analyze/history`

### Converter
- `POST /api/convert`
- `GET /api/convert/status/:jobId`

### Visualizer
- `POST /api/visualize`
- `GET /api/visualize/status/:jobId`
- `GET /api/visualize/presets`
- `POST /api/visualize/presets`

### USB Export
- `GET /api/usb/devices`
- `POST /api/usb/export`
- `GET /api/usb/status/:jobId`

### Export
- `GET /api/export/playlist/:format`

## Building for Production

### Build Web App
```bash
cd frontend
npm run build
```

Output: `frontend/dist/`

### Build Desktop App
```bash
# Build frontend first
cd frontend && npm run build

# Build Electron app
cd ../electron
npm run dist
```

Output: `electron/dist/`

## Environment Variables

Create `backend/.env`:
```
PORT=3001
NODE_ENV=production
JWT_SECRET=your-secret-key
```

## Database

SQLite database is automatically created at `backend/database/ricks.db`

Tables:
- `users` - User accounts
- `tracks` - Audio tracks
- `playlists` - User playlists
- `playlist_tracks` - Playlist track associations
- `analysis_results` - Mix analysis results
- `usb_exports` - USB export history
- `visual_presets` - Visualizer presets

## Notes

- The Mix Analyzer uses simulated track detection. In production, integrate with AcoustID/Chromaprint for real audio fingerprinting.
- The Visualizer export is simulated. In production, use FFmpeg to render actual videos.
- USB device detection is simulated. In production, use `drivelist` and `usb-detection` packages.
- File uploads are stored in `backend/uploads/`

## License

MIT License - See LICENSE file for details.