#!/bin/bash
# RESINA Tide Monitoring System - Quick Setup Script

set -e

echo "🌊 RESINA Tide Monitoring Setup"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "apps/api/package.json" ]; then
  echo "❌ Error: Run this script from the project root directory"
  exit 1
fi

# Step 1: Install dependencies
echo "📦 Installing API dependencies..."
cd apps/api
npm install
cd ../..

# Step 2: Check environment
echo ""
echo "🔐 Checking environment configuration..."
if [ ! -f "apps/api/.env" ]; then
  echo "⚠️  No .env file found. Copying .env.example..."
  cp apps/api/.env.example apps/api/.env
  echo "✓ Created .env, please fill in your credentials:"
  echo ""
  echo "  Edit: apps/api/.env"
  echo "    - SUPABASE_URL (from Supabase dashboard)"
  echo "    - SUPABASE_SERVICE_KEY (from Settings > API)"
  echo "    - STORMGLASS_API_KEY (provided)"
  echo ""
fi

# Step 3: Check Supabase connection
echo "🔗 Testing Supabase connection..."
if grep -q "placeholder" apps/api/.env; then
  echo "⚠️  Placeholder credentials detected. Update .env first!"
  exit 1
fi

# Step 4: Start API server (background)
echo ""
echo "🚀 Starting API server..."
cd apps/api
npm run dev &
API_PID=$!
sleep 2

# Step 5: Test health endpoint
echo ""
echo "🏥 Testing API health..."
if curl -s http://localhost:3001/health > /dev/null; then
  echo "✓ API server is running"
else
  echo "❌ API server failed to start"
  kill $API_PID 2>/dev/null
  exit 1
fi

# Step 6: Run tide fetch
echo ""
echo "🌊 Fetching today's tide data..."
npm run tide:fetch

# Step 7: Run interpolation
echo ""
echo "📈 Generating hourly tide estimates..."
npm run tide:interpolate

# Cleanup
kill $API_PID 2>/dev/null

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Set EXPO_PUBLIC_API_URL in mobile .env"
echo "  2. Start API: cd apps/api && npm run dev"
echo "  3. Start mobile: cd apps/mobile && npm start"
echo "  4. Add cron job for daily tide:fetch + tide:interpolate"
echo ""
