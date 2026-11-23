import { execFile } from 'child_process'
import path from 'path'
import fs from 'fs-extra'
import plist from 'plist'

function exec(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 15000, maxBuffer: 8 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout
        error.stderr = stderr
        reject(error)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${Number((value / 1024 ** index).toFixed(index === 0 ? 0 : 2))} ${units[index]}`
}

export async function listDevices(options = {}) {
  let devices = []
  if (process.platform === 'darwin') devices = await listMacDevices()
  else if (process.platform === 'win32') devices = await listWindowsDevices()
  else devices = await listLinuxDevices()

  for (const device of devices) {
    if (device.mountPoint) {
      try {
        const stat = await fs.statfs(device.mountPoint)
        device.freeBytes = stat.bavail * stat.bsize
        device.totalBytes = device.totalBytes || stat.blocks * stat.bsize
        device.free = formatBytes(device.freeBytes)
        device.size = formatBytes(device.totalBytes)
        device.writable = await testWritable(device.mountPoint)
      } catch {
        device.writable = false
      }
      device.library = await inspectDeviceLibrary(device.mountPoint)
    }
  }

  if (!devices.length && !options.allowFallback) {
    return []
  }
  return devices.sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

async function listMacDevices() {
  let list = { AllDisksAndPartitions: [] }
  try {
    const { stdout } = await exec('diskutil', ['list', '-plist', 'external'])
    list = plist.parse(stdout) || {}
  } catch {
    return []
  }

  const devices = []
  const seen = new Set()

  for (const disk of list.AllDisksAndPartitions || []) {
    const diskIdentifier = disk.DeviceIdentifier
    let diskInfo = {}
    try {
      const info = await exec('diskutil', ['info', '-plist', `/dev/${diskIdentifier}`])
      diskInfo = plist.parse(info.stdout) || {}
    } catch {
      diskInfo = {}
    }
    const partitions = disk.Partitions?.length ? disk.Partitions : [{ DeviceIdentifier: diskIdentifier, MountPoint: disk.MountPoint, VolumeName: disk.VolumeName }]
    for (const partition of partitions) {
      if (!partition.MountPoint && !diskInfo.MountPoint) continue
      const identifier = partition.DeviceIdentifier || diskIdentifier
      if (seen.has(identifier)) continue
      seen.add(identifier)
      let info = {}
      try {
        const result = await exec('diskutil', ['info', '-plist', `/dev/${identifier}`])
        info = plist.parse(result.stdout) || {}
      } catch {
        info = diskInfo
      }
      const mountPoint = partition.MountPoint || info.MountPoint || null
      if (!mountPoint) continue

      // CRITICAL: Filter out Mac internal disks and synthetic/system volumes.
      // Removable external DJ volumes on macOS must be mounted under /Volumes/
      if (!mountPoint.startsWith('/Volumes/')) continue
      if (mountPoint === '/' || mountPoint.startsWith('/System') || mountPoint.startsWith('/private')) continue
      if (info.Internal === true || diskInfo.Internal === true) continue

      const volumeName = info.VolumeName || partition.VolumeName || info.MediaName || info.DeviceNode || 'USB Device'
      // Exclude Cryptex, Recovery, Preboot, Macintosh HD, macOS System volumes
      if (/Cryptex|com\.apple|Recovery|Preboot|Macintosh HD|macOS|System|iSCPreboot|Hardware|VM/i.test(volumeName)) continue
      if (/Cryptex|com\.apple|Recovery|Preboot/i.test(mountPoint)) continue

      const isUSB = /USB/i.test(String(info.BusProtocol || diskInfo.BusProtocol || '')) ||
                    /USB/i.test(String(info.MediaType || '')) ||
                    Boolean(info.RemovableMedia || info.Ejectable)

      devices.push({
        id: identifier,
        device: `/dev/${identifier}`,
        name: volumeName,
        model: info.MediaName || diskInfo.MediaName || null,
        vendor: info.DeviceVendor || null,
        serial: info.DeviceSerialNumber || info.MediaSerialNumber || null,
        mountPoint,
        totalBytes: info.TotalSize || partition.Size || 0,
        filesystem: info.FilesystemType || info.FilesystemName || null,
        removable: Boolean(info.RemovableMedia || info.Ejectable || isUSB),
        isUSB,
        bus: info.BusProtocol || diskInfo.BusProtocol || null,
        status: 'mounted',
        platform: 'darwin',
      })
    }
  }
  return devices
}

async function listWindowsDevices() {
  const script = [
    'Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 -or $_.DriveType -eq 3 } |',
    'Select-Object DeviceID,VolumeName,Size,FreeSpace,FileSystem,DriveType | ConvertTo-Json -Compress',
  ].join(' ')
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-Command', script])
  const parsed = stdout.trim() ? JSON.parse(stdout) : []
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  const devices = []
  for (const row of rows) {
    const mountPoint = row.DeviceID ? `${row.DeviceID}\\` : null
    if (!mountPoint) continue
    const isUSB = await isWindowsUsbDrive(row.DeviceID)
    if (!isUSB && Number(row.DriveType) !== 2) continue
    devices.push({
      id: row.DeviceID,
      device: row.DeviceID,
      name: row.VolumeName || `Removable ${row.DeviceID}`,
      mountPoint,
      totalBytes: Number(row.Size) || 0,
      freeBytes: Number(row.FreeSpace) || 0,
      filesystem: row.FileSystem || null,
      removable: Number(row.DriveType) === 2,
      isUSB,
      status: 'mounted',
      platform: 'win32',
    })
  }
  return devices
}

async function isWindowsUsbDrive(driveLetter) {
  try {
    const script = [
      `$disk = Get-CimInstance Win32_LogicalDiskToPartition | Where-Object { $_.Dependent -like '*${driveLetter}*' }`,
      '$disk | ForEach-Object { $_.Antecedent } | ConvertTo-Json -Compress',
    ].join('; ')
    const { stdout } = await exec('powershell.exe', ['-NoProfile', '-Command', script])
    return /USB/i.test(stdout)
  } catch {
    return true
  }
}

async function listLinuxDevices() {
  const { stdout } = await exec('lsblk', ['--json', '--bytes', '-o', 'NAME,LABEL,SIZE,FSTYPE,MOUNTPOINT,TRAN,REMOVABLE,MODEL,SERIAL'])
  const parsed = JSON.parse(stdout)
  const devices = []
  const walk = (nodes, parent = null) => {
    for (const node of nodes || []) {
      const mountPoint = node.mountpoint || node.mountpoints?.[0] || null
      const isUSB = String(node.tran || '').toLowerCase() === 'usb' || Number(node.rm) === 1
      if (mountPoint && isUSB) {
        devices.push({
          id: node.name,
          device: `/dev/${node.name}`,
          name: node.label || node.model || node.name,
          model: node.model || parent?.model || null,
          serial: node.serial || parent?.serial || null,
          mountPoint,
          totalBytes: Number(node.size) || 0,
          filesystem: node.fstype || null,
          removable: true,
          isUSB: true,
          bus: node.tran || null,
          status: 'mounted',
          platform: 'linux',
        })
      }
      walk(node.children, node)
    }
  }
  walk(parsed.blockdevices)
  return devices
}

async function testWritable(mountPoint) {
  const testFile = path.join(mountPoint, `.sounditdj-write-test-${Date.now()}`)
  try {
    await fs.writeFile(testFile, 'test', { flag: 'wx' })
    await fs.remove(testFile)
    return true
  } catch {
    return false
  }
}

export async function inspectDeviceLibrary(mountPoint) {
  const markers = []
  const checks = [
    { type: 'rekordbox-usb', path: path.join(mountPoint, 'PIONEER', 'rekordbox', 'export.pdb') },
    { type: 'rekordbox-usb', path: path.join(mountPoint, 'PIONEER', 'rekordbox', 'exportExt.pdb') },
    { type: 'rekordbox-usb', path: path.join(mountPoint, 'PIONEER', 'rekordbox', 'rekordbox.xml') },
    { type: 'serato', path: path.join(mountPoint, '_Serato_', 'database V2') },
    { type: 'serato', path: path.join(mountPoint, '_Serato_', 'Subcrates') },
    { type: 'engine-dj', path: path.join(mountPoint, 'Engine Library', 'Database2', 'm.db') },
    { type: 'engine-dj', path: path.join(mountPoint, 'Engine Library') },
    { type: 'traktor', path: path.join(mountPoint, 'collection.nml') },
    { type: 'virtualdj', path: path.join(mountPoint, 'VirtualDJ', 'database.xml') },
    { type: 'virtualdj', path: path.join(mountPoint, 'VirtualDJ') },
  ]
  for (const check of checks) {
    if (await fs.pathExists(check.path)) {
      try {
        const stat = await fs.stat(check.path)
        markers.push({ ...check, size: stat.size, modified: stat.mtime.toISOString() })
      } catch {
        markers.push({ ...check, size: 0, modified: new Date().toISOString() })
      }
    }
  }
  const scan = async (dir, depth = 0) => {
    if (depth > 2) return
    let entries = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (['PIONEER', 'Contents', '_Serato_', 'Engine Library', 'Music'].includes(entry.name)) continue
        await scan(fullPath, depth + 1)
      } else if (/\.(m3u|m3u8|csv|xml)$/i.test(entry.name) && markers.length < 20) {
        markers.push({ type: 'playlist', path: fullPath })
      }
    }
  }
  await scan(mountPoint)
  const summary = await summarizeDirectory(mountPoint)
  return {
    detected: [...new Set(markers.map((marker) => marker.type))],
    markers,
    audioFiles: summary.audioFiles,
    playlists: summary.playlists,
    usedBytes: summary.bytes,
  }
}

async function summarizeDirectory(root) {
  let audioFiles = 0
  let playlists = 0
  let bytes = 0
  let visited = 0
  async function walk(dir) {
    if (visited > 5000) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      visited += 1
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (['PIONEER', 'Contents', '_Serato_', 'Engine Library'].includes(entry.name)) continue
        await walk(fullPath)
      } else if (/\.(mp3|wav|flac|aiff|aif|m4a|aac|ogg)$/i.test(entry.name)) {
        audioFiles += 1
        try {
          bytes += (await fs.stat(fullPath)).size
        } catch {
          // ignore inaccessible files
        }
      } else if (/\.(m3u|m3u8|csv|xml)$/i.test(entry.name)) {
        playlists += 1
      }
    }
  }
  await walk(root)
  return { audioFiles, playlists, bytes }
}

export async function browseDevice(mountPoint, relativePath = '') {
  const root = path.resolve(mountPoint)
  const target = path.resolve(root, relativePath || '.')
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('Requested path is outside the device')
  }
  const stat = await fs.stat(target)
  if (!stat.isDirectory()) throw new Error('Requested path is not a directory')
  const entries = await fs.readdir(target, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = path.join(target, entry.name)
    let entryStat
    try {
      entryStat = await fs.stat(fullPath)
    } catch {
      continue
    }
    results.push({
      name: entry.name,
      path: path.relative(root, fullPath),
      type: entry.isDirectory() ? 'directory' : 'file',
      size: entry.isDirectory() ? null : entryStat.size,
      modified: entryStat.mtime.toISOString(),
    })
  }
  return results.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Scan device audio tracks with metadata for first-class browsing directly in the library view.
 */
export async function browseDeviceTracks(mountPoint, relativePath = '') {
  const root = path.resolve(mountPoint)
  const target = path.resolve(root, relativePath || '.')
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('Requested path is outside the device')
  }

  const tracks = []
  const maxTracks = 1500
  const audioExtensions = new Set(['.mp3', '.wav', '.flac', '.aiff', '.aif', '.m4a', '.aac', '.ogg'])

  async function scan(dir, depth = 0) {
    if (depth > 5 || tracks.length >= maxTracks) return
    let entries = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (tracks.length >= maxTracks) break
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (['.Trashes', '.fseventsd', '.Spotlight-V100', 'System Volume Information'].includes(entry.name)) continue
        await scan(fullPath, depth + 1)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (audioExtensions.has(ext)) {
          let stat = null
          try {
            stat = await fs.stat(fullPath)
          } catch {
            continue
          }

          const baseName = path.basename(entry.name, ext)
          let title = baseName
          let artist = 'Unknown Artist'
          if (baseName.includes(' - ')) {
            const parts = baseName.split(' - ')
            artist = parts[0].trim()
            title = parts.slice(1).join(' - ').trim()
          }

          tracks.push({
            id: `usb-${Buffer.from(fullPath).toString('base64url').slice(0, 36)}`,
            sourceId: fullPath,
            title,
            artist,
            album: path.basename(path.dirname(fullPath)),
            duration: 0,
            bpm: null,
            key: null,
            rating: 0,
            path: fullPath,
            relativePath: path.relative(root, fullPath),
            filename: entry.name,
            fileSize: stat.size,
            format: ext.replace('.', '').toUpperCase(),
            isUsbTrack: true,
            usbMountPoint: root,
            createdAt: stat.mtime.toISOString(),
          })
        }
      }
    }
  }

  await scan(target)
  return tracks
}

export async function getDevice(identifier) {
  const devices = await listDevices()
  return devices.find((device) => device.id === identifier || device.device === identifier || device.mountPoint === identifier) || null
}

export async function ejectDevice(identifier) {
  const device = await getDevice(identifier)
  if (!device) throw new Error('Device not found')
  if (process.platform === 'darwin') {
    await exec('diskutil', ['eject', device.device])
    return { ejected: true, device: device.device }
  }
  if (process.platform === 'win32') {
    const letter = device.id.replace(':', '')
    const script = `(New-Object -comObject Shell.Application).Namespace(17).ParseName('${letter}:').InvokeVerb('Eject')`
    await exec('powershell.exe', ['-NoProfile', '-Command', script])
    return { ejected: true, device: device.id }
  }
  await exec('udisksctl', ['unmount', '-b', device.device]).catch(() => {})
  await exec('udisksctl', ['power-off', '-b', device.device]).catch(() => {})
  return { ejected: true, device: device.device }
}

/** Simple polling helper usable from both Electron and route layers. */
export function startDeviceWatcher(callback, intervalMs = 2500) {
  let lastFingerprint = ''
  let timer = null
  const poll = async () => {
    try {
      const devices = await listDevices()
      const fingerprint = JSON.stringify(devices.map((device) => ({
        id: device.id,
        mountPoint: device.mountPoint,
        freeBytes: device.freeBytes,
      })))
      if (fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint
        callback(devices)
      }
    } catch (error) {
      callback([], error)
    }
  }
  poll()
  timer = setInterval(poll, intervalMs)
  return () => clearInterval(timer)
}
