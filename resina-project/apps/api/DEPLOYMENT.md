# API Server Deployment Guide

## Quick Deploy to Vercel

```bash
cd apps/api

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

Select project, set environment variables, and deploy.

## Environment Variables (Set in Vercel/Deployment Platform)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
STORMGLASS_API_KEY=your-stormglass-api-key
PORT=3001
NODE_ENV=production
```

## Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
EXPOSE 3001
CMD ["npm", "start"]
```

Build and push:
```bash
docker build -t resina-api .
docker push your-registry/resina-api:latest
```

## Mobile Environment Variables

Once deployed, set in `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://your-api-domain.vercel.app
```

## Monitoring

Configure uptime monitoring to ping `/api/health` every 5 minutes.

Alert if response code ≠ 200 for 10+ minutes.
