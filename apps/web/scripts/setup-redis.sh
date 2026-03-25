#!/bin/bash

# Redis Setup Script
# 
# Installs Redis locally and sets up for development
# Usage: ./scripts/setup-redis.sh

set -e

REDIS_VERSION="7.2.4"
REDIS_DIR="${HOME}/.local/redis"
REDIS_BIN="${REDIS_DIR}/bin/redis-server"

echo "🔧 Setting up Redis for development..."

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  echo "📦 Detected macOS"
  
  if ! command -v redis-server &> /dev/null; then
    echo "Installing Redis via Homebrew..."
    brew install redis
  else
    echo "✅ Redis already installed"
    redis-server --version
  fi
  
  # Start Redis if not running
  if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis..."
    brew services start redis
  else
    echo "✅ Redis already running"
  fi

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux
  echo "📦 Detected Linux"
  
  if ! command -v redis-server &> /dev/null; then
    echo "Installing Redis..."
    sudo apt-get update
    sudo apt-get install -y redis-server
  else
    echo "✅ Redis already installed"
    redis-server --version
  fi
  
  # Start Redis if not running
  if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis..."
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
  else
    echo "✅ Redis already running"
  fi

else
  echo "⚠️  Unsupported OS: $OSTYPE"
  echo "Please install Redis manually from https://redis.io/download"
  exit 1
fi

# Verify installation
echo ""
echo "✅ Verifying Redis installation..."
redis-cli ping

if [ $? -eq 0 ]; then
  echo ""
  echo "🎉 Redis setup complete!"
  echo ""
  echo "To test Redis connection:"
  echo "  redis-cli"
  echo ""
  echo "To stop Redis (macOS):"
  echo "  brew services stop redis"
  echo ""
  echo "To stop Redis (Linux):"
  echo "  sudo systemctl stop redis-server"
  echo ""
  echo "Next steps:"
  echo "  1. Run database migrations: npm run db:migrate"
  echo "  2. Start app: npm run dev"
  echo "  3. In another terminal: npm run dev:worker"
else
  echo "❌ Redis verification failed"
  exit 1
fi
