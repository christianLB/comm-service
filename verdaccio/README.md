# Verdaccio Private NPM Registry Setup

This directory contains everything needed to deploy Verdaccio (private NPM registry) to your NAS.

## Quick Start

### Option 1: Automated Deployment to NAS

```bash
cd verdaccio
chmod +x deploy-to-nas.sh
./deploy-to-nas.sh
```

This script will:
1. Check SSH connectivity to your NAS
2. Package all Verdaccio files
3. Deploy to NAS at `/volume1/docker/verdaccio`
4. Optionally start Verdaccio

### Option 2: Manual Installation on NAS

1. **Copy files to NAS:**
```bash
scp -r verdaccio/ k2600x@192.168.1.11:/volume1/docker/
```

2. **SSH to NAS:**
```bash
ssh k2600x@192.168.1.11
cd /volume1/docker/verdaccio
```

3. **Start Verdaccio:**
```bash
docker-compose up -d
```

### Option 3: Run Locally for Testing

```bash
cd verdaccio
docker-compose up -d
```

Access at: http://localhost:4873

## Initial Setup

### 1. Create Users

After Verdaccio is running, create users:

**On NAS:**
```bash
ssh k2600x@192.168.1.11
cd /volume1/docker/verdaccio
./setup-users.sh
```

**Or manually:**
```bash
# Create user with npm
npm adduser --registry http://192.168.1.11:4873/
```

### 2. Configure NPM Client

Add to your `~/.npmrc` or project `.npmrc`:
```
registry=http://192.168.1.11:4873
//192.168.1.11:4873/:_authToken=YOUR_TOKEN_HERE
```

### 3. Login

```bash
npm login --registry http://192.168.1.11:4873/
```

## Publishing Packages

### Publish the Comm Service SDK

From the project root:
```bash
cd ..
./publish-sdk.sh
```

Or manually:
```bash
cd sdk
npm publish --registry http://192.168.1.11:4873
```

### Publish Scoped Packages

For `@k2600x/*` packages:
```bash
npm publish --access public --registry http://192.168.1.11:4873
```

## Configuration

### Important Files

- `docker-compose.yml` - Docker container configuration
- `conf/config.yaml` - Verdaccio configuration
- `conf/htpasswd` - User authentication file (created automatically)
- `storage/` - Package storage directory

### Configuration Details

- **Port:** 4873
- **Storage:** Persistent volume at `./storage`
- **Authentication:** htpasswd with bcrypt
- **Uplinks:** Proxies to npmjs.org for public packages
- **Scope:** `@k2600x/*` packages are private

### Security

The current configuration:
- Allows authenticated users to read `@k2600x/*` packages
- Only `k2600x` user can publish `@k2600x/*` packages
- Public packages are proxied from npmjs.org
- Web UI is accessible to all (authentication required for actions)

## Monitoring

### Check Status
```bash
docker ps | grep verdaccio
```

### View Logs
```bash
docker logs verdaccio
# or
docker-compose logs -f
```

### Access Web UI
Open in browser: http://192.168.1.11:4873

## Troubleshooting

### Verdaccio won't start
1. Check if port 4873 is already in use
2. Ensure Docker is installed on NAS
3. Check logs: `docker-compose logs`

### Can't publish packages
1. Ensure you're logged in: `npm whoami --registry http://192.168.1.11:4873/`
2. Check user permissions in `conf/config.yaml`
3. Verify authentication token in `.npmrc`

### Connection refused
1. Check if Verdaccio is running: `docker ps`
2. Verify firewall allows port 4873
3. Test connectivity: `curl http://192.168.1.11:4873`

## Backup

To backup Verdaccio data:
```bash
tar -czf verdaccio-backup.tar.gz storage/ conf/htpasswd
```

## Updates

To update Verdaccio:
```bash
docker-compose pull
docker-compose down
docker-compose up -d
```

## Uninstall

To remove Verdaccio:
```bash
docker-compose down
docker volume prune  # Optional: remove unused volumes
rm -rf storage/ conf/htpasswd
```

## Advanced Configuration

### Enable HTTPS

1. Generate certificates:
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout conf/server.key -out conf/server.crt
```

2. Update `conf/config.yaml`:
```yaml
https:
  key: /verdaccio/conf/server.key
  cert: /verdaccio/conf/server.crt
```

3. Update docker-compose.yml to expose port 443

### Email Notifications

Add to `conf/config.yaml`:
```yaml
notify:
  method: POST
  headers: [{'Content-Type': 'application/json'}]
  endpoint: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
  content: '{"text": "Package published: *{{ name }}*"}'
```

## Support

For issues or questions:
1. Check Verdaccio docs: https://verdaccio.org/docs/
2. Check container logs: `docker-compose logs`
3. Verify network connectivity to NAS