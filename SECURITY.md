# Security Engineering Specification - Implementation Status

This document maps the platform security controls to the current implementation and deployment requirements.

## 1. API Security

### Implemented in code
- Mandatory JWT auth for all non-auth API routes.
- JWT claims include `exp`, `sub` (user ID), and `scope`.
- Global API rate limiting with default `100 req/min/IP`.
- Additional stricter limits for auth, upload, and integration routes.
- Request validation and typed input guards across core routes.
- API request/audit logging with request IDs.

### Deploy with gateway/WAF
Place the backend behind Cloudflare, Kong, Nginx, or AWS API Gateway and enforce:
- Upstream rate limiting and bot controls.
- IP allow/deny rules.
- Request size and schema filtering where available.
- Centralized traffic logs.

## 2. Data Security

### Implemented in code
- Passwords hashed with bcrypt (12 rounds).
- Raw auth tokens are not stored in DB.
- CORS and secure response headers enabled.

### Deployment requirements
- TLS 1.3 termination at edge/load balancer.
- At-rest encryption via encrypted disk/volume (for SQLite file and backups).
- Secret management for JWT/API keys (never commit secrets).

## 3. Anti-Fraud Controls

### Implemented in code
- Login brute-force detection per email+IP.
- Temporary account lockout after repeated failed attempts.
- Security event logging for failed/successful auth actions.

## 4. Bot and DDoS Protection

### Implemented in code
- Per-IP request limiting.
- Adaptive protection mode triggered on >300% traffic spike over rolling baseline.

### Deploy with edge controls
- Enable Cloudflare bot management.
- Add CAPTCHA challenge rules for suspicious traffic classes.

## 5. File Upload Security

### Implemented in code
- Strict MIME + extension allowlists.
- Forbidden executable/script extension blocklist (`.exe`, `.sh`, `.js`, `.php`, etc.).
- Magic-byte signature checks.
- Malware pattern checks (EICAR).
- Optional ClamAV scan (`clamscan`) if installed.

### Deployment requirements
- Store uploads in isolated object storage (S3 or Cloudflare R2) for production.
- Serve media through signed URLs/CDN policies.

## 6. Server Hardening (Ops)

Required for production infrastructure:
- Disable root SSH login.
- SSH keys only.
- Restrict inbound ports to `443` and limited `22`.
- Host firewall and security groups default-deny.

## 7. Database Security

### Implemented in code
- User-scoped data access in API queries for tracks/playlists/settings/analysis/presets.

### Deployment requirements
- Do not expose DB to public internet.
- Restrict DB/file access to app host only.
- Encrypt backups and store offsite.

## 8. Logging & Threat Detection

### Implemented in code
- Structured audit logs: `backend/logs/audit.log`.
- Security events: `backend/logs/security.log`.
- Request ID propagation (`x-request-id`).

### Recommended integrations
- Ship logs to ELK / Datadog / Grafana Loki + alerting.

## 9. Intrusion Detection (Ops)

Configure on host/network:
- Fail2ban or CrowdSec for SSH/API abuse patterns.
- Wazuh/EDR for host-level detection.

## 10. Security Audits

Run routinely:
- `npm audit` (backend + frontend)
- SAST and dependency scans (Snyk/Dependabot)
- OWASP ZAP API scans
- Periodic penetration tests

## 11. Incident Response

If compromise is suspected:
1. Isolate affected service/host.
2. Block offending traffic at edge and firewall.
3. Rotate secrets, JWT secret, and integration keys.
4. Restore clean state from encrypted backups.
5. Investigate logs and preserve evidence timeline.

## Operational Notes
- Configure environment values from `backend/.env.example`.
- In production, always set a strong `JWT_SECRET` and `RAPIDAPI_KEY` through a secrets manager.
- AI agent endpoints can run without API key, but LLM features are disabled until `KIMI_API_KEY` or `OPENAI_API_KEY` is configured.
