# Sound It DJ Production Deployment Guide

Since direct SSH access to `192.168.1.14` is restricted (SSH Keys only), I have prepared all the necessary files locally for you to trigger the deployment.

## 📦 Deployment Package Contents
- **Frontend Build**: Located in `frontend/dist/` (already built).
- **Backend Dockerfile**: [backend/Dockerfile](file:///Users/djfredmax/Desktop/KRE8/backend/Dockerfile)
- **Production Config**: [backend/.env.production](file:///Users/djfredmax/Desktop/KRE8/backend/.env.production)
- **Docker Compose**: [docker-compose.yml](file:///Users/djfredmax/Desktop/KRE8/docker-compose.yml)

## 🚀 How to Deploy

### Option 1: Via Portainer (Recommended)
1. Open [http://192.168.1.14:9000](http://192.168.1.14:9000) in your browser.
2. Go to **Stacks** -> **Add stack**.
3. Copy and paste the contents of [docker-compose.yml](file:///Users/djfredmax/Desktop/KRE8/docker-compose.yml).
4. Deploy the stack.

### Option 2: Manual Terminal (on the server)
If you have console/RDP access to the server:
1. Zip the `sounditdj` folder.
2. Copy it to `D:\soundit-cloud\apps\sounditdj`.
3. Run:
   ```powershell
   docker-compose up -d --build
   ```

## 🌐 Post-Deployment
- **Frontend**: Accessible at `http://192.168.1.14:5173`
- **Backend API**: Accessible at `http://192.168.1.14:3001`
- **Stored Data**: Persisted in `D:\soundit-cloud\apps\sounditdj\database`

> [!NOTE]
> The `docker-compose.yml` is configured to use the existing `soundit-network`. Ensure this network exists in your Docker environment.
