# FMX DJ - Professional DJ Library & Mix Intelligence Platform

A comprehensive DJ management and intelligence platform designed to help DJs collect music, organize libraries, analyze mixes, and generate tracklists automatically.

![FMX DJ](https://img.shields.io/badge/FMX-DJ-yellow)
![React](https://img.shields.io/badge/React-18-blue)
![Node.js](https://img.shields.io/badge/Node.js-18-green)
![Electron](https://img.shields.io/badge/Electron-28-blueviolet)

## Features

### Core Features

- **DJ Library Manager**: Import, organize, and manage tracks from all major formats (MP3, WAV, FLAC, AAC)
- **AI Mix Analyzer**: Upload mixes and let AI detect tracks, timestamps, BPM, and generate accurate tracklists
- **Visualizer Creator**: Create stunning audio-reactive videos with 10+ visual effects including particles, waveforms, spectrum, and more
- **Playlist Converter**: Convert playlists between Rekordbox, Serato, Traktor, Virtual DJ, and more
- **Audio Converter**: Convert between audio formats with batch processing
- **Cover Art Creator**: Design professional cover art for mixes and releases with customizable templates
- **USB Export**: Export playlists directly to USB drives formatted for Pioneer CDJs and other DJ equipment
- **Music Integrations**: Spotify downloads, Spotify lyrics, Audiomack playback links, SoundCloud reposter analytics, and Shazam-style recognition

### Additional Features

- **Song Identification**: Identify unknown tracks using audio fingerprinting
- **Metadata Extraction**: Automatically extract title, artist, album, BPM, key, and artwork
- **Waveform Visualization**: Visual waveform preview for all tracks
- **Mini Audio Player**: Fixed bottom player with playback controls and volume
- **Dark Theme**: Modern dark UI with yellow (#FFFF00) accent and smooth animations

## Tech Stack

### Frontend
- React 18 + Vite
- Tailwind CSS
- Framer Motion (animations)
- Zustand (state management)
- React Router
- Axios
- React Hot Toast
- Lucide React (icons)

### Backend
- Node.js + Express
- SQLite (sqlite3)
- Multer (file uploads)
- music-metadata (metadata extraction)
- FFmpeg (audio conversion)
- RapidAPI integration (Spotify download, Spotify lyrics, Audiomack play, SoundCloud reposters, Shazam recognition)

### Desktop
- Electron
- electron-is-dev

## Project Structure

```
fmx-dj/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── store/        # Zustand stores
│   │   ├── styles/       # CSS styles
│   │   ├── config/       # Configuration files
│   │   └── App.jsx       # Main app component
│   ├── package.json
│   └── vite.config.js
├── backend/           # Node.js + Express backend
│   ├── src/
│   │   ├── routes/       # API routes
│   │   └── index.js      # Server entry
│   ├── database/         # SQLite database
│   ├── uploads/          # Uploaded files
│   └── package.json
├── electron/          # Electron desktop app
│   ├── main.js           # Main process
│   ├── preload.js        # Preload script
│   └── package.json
└── package.json       # Root package.json
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- FFmpeg (for audio conversion)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/fmx-dj.git
cd fmx-dj
```

2. Install all dependencies:
```bash
npm run install:all
```

Or install manually:
```bash
npm install
cd frontend && npm install
cd ../backend && npm install
cd ../electron && npm install
```

3. Start the development servers:

**Run everything (backend + frontend):**
```bash
npm run dev
```

**Access the App:**
- **Web App**: http://localhost:5173
- **Backend API**: http://localhost:3001

### Access the App

- **Web App**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Desktop App**: Launches automatically when running `npm run electron`

## Building for Production

### Build Web App
```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`

### Build Desktop App
```bash
# Build frontend first
cd frontend && npm run build

# Build Electron app
cd ../electron
npm run dist
```

### Build for Different Platforms
```bash
# macOS
cd electron && npm run dist -- --mac

# Windows
cd electron && npm run dist -- --win

# Linux
cd electron && npm run dist -- --linux
```

## Production Deployment

### Deploy Backend

1. Set environment variables:
```bash
export NODE_ENV=production
export PORT=3001
```

2. Start the backend:
```bash
cd backend
npm start
```

### Deploy Frontend (Static Hosting)

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Deploy the `dist` folder to any static hosting service (Vercel, Netlify, etc.)

3. Ensure the API URL is configured in `.env.production`:
```
VITE_API_URL=https://your-api-domain.com
```

### Full Stack Deployment (Same Server)

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Copy the built files to the backend's public folder:
```bash
cp -r frontend/dist/* backend/public/
```

3. Configure backend to serve static files (already configured in `backend/src/index.js`)

4. Start the backend:
```bash
cd backend
npm start
```

The app will be available at `http://your-server:3001`

## API Endpoints

### Health Check
- `GET /api/health` - Check server status

### Library
- `POST /api/library/upload` - Upload audio file
- `GET /api/library/list` - List all tracks
- `PUT /api/library/update/:id` - Update track metadata
- `DELETE /api/library/:id` - Delete track
- `GET /api/library/:id` - Get single track

### Playlists
- `POST /api/playlist/create` - Create playlist
- `GET /api/playlist/list` - List playlists
- `GET /api/playlist/:id` - Get playlist with tracks
- `PUT /api/playlist/update` - Update playlist
- `DELETE /api/playlist/delete/:id` - Delete playlist
- `POST /api/playlist/add-track` - Add track to playlist
- `POST /api/playlist/remove-track` - Remove track from playlist

### Mix Analyzer
- `POST /api/analyze` - Start mix analysis
- `GET /api/analyze/status/:jobId` - Get analysis status
- `GET /api/analyze/history` - Get analysis history

### Audio Converter
- `POST /api/convert` - Convert audio file
- `GET /api/convert/status/:jobId` - Get conversion status

### Visualizer
- `POST /api/visualize` - Create visualization
- `GET /api/visualize/status/:jobId` - Get visualization status
- `GET /api/visualize/presets` - Get visual presets
- `POST /api/visualize/presets` - Save visual preset

### USB Export
- `GET /api/usb/devices` - List USB devices
- `POST /api/usb/export` - Export to USB
- `GET /api/usb/status/:jobId` - Get export status

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings
- `PUT /api/settings/account` - Update account info
- `POST /api/settings/upload-photo` - Upload profile photo
- `POST /api/settings/clear-cache` - Clear cache
- `GET /api/settings/storage` - Get storage info

### Music Integrations
- `GET /api/integration/providers` - View configured provider hosts and current Shazam path
- `POST /api/integration/recognize` - Recognize a track from a public audio URL
- `GET /api/integration/spotify/download` - Generate a Spotify track download link
- `GET /api/integration/spotify/lyrics` - Fetch lyrics for a Spotify track ID or URL
- `GET /api/integration/audiomack/play/:songId` - Generate a signed Audiomack stream URL
- `GET /api/integration/soundcloud/reposters` - Load SoundCloud reposters for a numeric track ID
- `POST /api/integration/download` - Legacy Spotify download shim for existing clients
- `POST /api/integration/download-track` - Legacy Spotify download shim for existing clients
- `GET /api/integration/search` - Returns an empty result set in this provider configuration

## Environment Variables

### Backend (.env)
```
PORT=3001
NODE_ENV=development
RAPIDAPI_KEY=your-rapidapi-key
SHAZAM_RECOGNIZE_PATH=tracks/recognize
```

### Frontend (.env.development)
```
VITE_API_URL=http://localhost:3001
```

### Frontend (.env.production)
```
VITE_API_URL=/api
```

## Visualizer Effects

The visualizer includes 10 different audio-reactive effects:

1. **Spectrum** - Classic frequency spectrum bars
2. **Waveform** - Audio waveform visualization with glow
3. **Particles** - Connected particle system that reacts to audio
4. **Audio Bars** - Centered mirrored bars
5. **Circular** - Radial circular visualization
6. **Grid Wave** - 2D grid that reacts to frequencies
7. **Triangles** - Geometric triangle patterns
8. **Hexagon** - Concentric hexagon rings
9. **Starfield** - 3D starfield with audio-reactive motion
10. **Oscilloscope** - Classic oscilloscope with multiple waves

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Design inspiration from modern DJ software
- Icons by [Lucide](https://lucide.dev/)
- Audio processing with [FFmpeg](https://ffmpeg.org/)

## Support

For support, email support@fmxdj.com or join our Discord community.

---

Built with passion for DJs worldwide. FMX DJ - The future of DJ software.
