#!/bin/bash
# ==========================================
# MedSwift Pentest Environment Installer
# Auto-installs Docker if not present
# ==========================================

set -e  # Exit on any error

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Function to check if Docker is installed
check_docker() {
    if command -v docker &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to check if Docker daemon is running
check_docker_running() {
    if docker info &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to install Docker on Linux
install_docker_linux() {
    print_message "$YELLOW" "📦 Installing Docker on Linux..."
    
    # Detect the Linux distribution
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        print_message "$RED" "❌ Cannot detect Linux distribution"
        exit 1
    fi

    case $OS in
        ubuntu|debian)
            print_message "$BLUE" "Detected Ubuntu/Debian system"
            sudo apt-get update
            sudo apt-get install -y \
                ca-certificates \
                curl \
                gnupg \
                lsb-release

            # Add Docker's official GPG key
            sudo mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

            # Set up repository
            echo \
              "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
              $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

            # Install Docker
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

            # Add current user to docker group
            sudo usermod -aG docker $USER
            print_message "$GREEN" "✅ Docker installed successfully!"
            print_message "$YELLOW" "⚠️  You may need to log out and back in for group permissions to take effect"
            ;;
        
        fedora|rhel|centos)
            print_message "$BLUE" "Detected Fedora/RHEL/CentOS system"
            sudo dnf -y install dnf-plugins-core
            sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
            sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -aG docker $USER
            print_message "$GREEN" "✅ Docker installed successfully!"
            ;;
        
        *)
            print_message "$RED" "❌ Unsupported Linux distribution: $OS"
            print_message "$YELLOW" "Please install Docker manually from: https://docs.docker.com/engine/install/"
            exit 1
            ;;
    esac
}

# Function to install Docker on macOS
install_docker_mac() {
    print_message "$YELLOW" "📦 Installing Docker on macOS..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        print_message "$YELLOW" "Installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    print_message "$BLUE" "Installing Docker Desktop via Homebrew..."
    brew install --cask docker
    
    print_message "$GREEN" "✅ Docker Desktop installed!"
    print_message "$YELLOW" "⚠️  Please start Docker Desktop from Applications folder"
    print_message "$YELLOW" "⚠️  Waiting for Docker Desktop to start..."
    
    # Wait for Docker Desktop to start
    open -a Docker
    sleep 10
    
    # Wait up to 60 seconds for Docker to be ready
    for i in {1..12}; do
        if check_docker_running; then
            print_message "$GREEN" "✅ Docker is ready!"
            break
        fi
        print_message "$YELLOW" "Waiting for Docker to start... ($i/12)"
        sleep 5
    done
}

# Function to detect OS and install Docker
install_docker() {
    print_message "$BLUE" "🔍 Detecting operating system..."
    
    case "$(uname -s)" in
        Linux*)
            install_docker_linux
            ;;
        Darwin*)
            install_docker_mac
            ;;
        MINGW*|MSYS*|CYGWIN*)
            print_message "$RED" "❌ Windows detected"
            print_message "$YELLOW" "Please install Docker Desktop for Windows manually:"
            print_message "$YELLOW" "https://docs.docker.com/desktop/install/windows-install/"
            exit 1
            ;;
        *)
            print_message "$RED" "❌ Unsupported operating system"
            exit 1
            ;;
    esac
}

# Function to start Docker service if not running
start_docker_service() {
    print_message "$YELLOW" "🚀 Starting Docker service..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo systemctl start docker
        sudo systemctl enable docker
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        open -a Docker
        sleep 10
    fi
    
    # Wait for Docker to be ready
    for i in {1..12}; do
        if check_docker_running; then
            print_message "$GREEN" "✅ Docker is running!"
            return 0
        fi
        print_message "$YELLOW" "Waiting for Docker to start... ($i/12)"
        sleep 5
    done
    
    print_message "$RED" "❌ Docker failed to start. Please start it manually."
    exit 1
}

# Main installation flow
print_message "$GREEN" "🚀 Starting MedSwift installation..."

# Step 1: Check if Docker is installed
if ! check_docker; then
    print_message "$YELLOW" "⚠️  Docker is not installed on this system"
    read -p "Do you want to install Docker automatically? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_docker
    else
        print_message "$RED" "❌ Docker is required. Exiting."
        exit 1
    fi
fi

# Step 2: Check if Docker is running
if ! check_docker_running; then
    print_message "$YELLOW" "⚠️  Docker is installed but not running"
    start_docker_service
fi

# Step 3: Verify Docker is working
if ! check_docker_running; then
    print_message "$RED" "❌ Docker is not responding. Please check your installation."
    exit 1
fi

print_message "$GREEN" "✅ Docker is ready!"

# Step 4: Clean up old containers
print_message "$BLUE" "🧹 Cleaning up old containers..."
docker rm -f medswift-app medswift-redis medswift-mongo 2>/dev/null || true

# Step 5: Create dedicated network
print_message "$BLUE" "🌐 Creating private Docker network..."
docker network create pentest-net 2>/dev/null || true

# Step 6: Start Redis
print_message "$BLUE" "📦 Pulling and starting Redis..."
docker run -d \
  --name medswift-redis \
  --net pentest-net \
  --restart always \
  redis:alpine

# Step 7: Start MongoDB
print_message "$BLUE" "📦 Pulling and starting MongoDB..."
docker run -d \
  --name medswift-mongo \
  --net pentest-net \
  --restart always \
  mongo:latest

# Step 8: Start MedSwift Application
print_message "$BLUE" "🔥 Pulling and starting MedSwift App..."
docker run -d \
  --name medswift-app \
  --net pentest-net \
  --restart always \
  -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e REDIS_URL=redis://medswift-redis:6379 \
  -e MONGO_URL=mongodb://medswift-mongo:27017/medswift_db \
  rajashekarpatha0707/medswift-pentest:v1

# Step 9: Wait for services to initialize
print_message "$BLUE" "⏳ Waiting for services to initialize..."
sleep 5

# Step 10: Verify containers are running
print_message "$BLUE" "🔍 Verifying container status..."
if docker ps | grep -q medswift-app && \
   docker ps | grep -q medswift-redis && \
   docker ps | grep -q medswift-mongo; then
    print_message "$GREEN" "✅ All containers are running!"
else
    print_message "$RED" "⚠️  Some containers may not have started correctly"
    print_message "$YELLOW" "Check logs with: docker logs medswift-app"
fi

# Final status output
echo ""
print_message "$GREEN" "==========================================="
print_message "$GREEN" "✅ SETUP COMPLETE"
print_message "$GREEN" "==========================================="
print_message "$BLUE" "🌐 Application URL:    http://localhost:3000"
print_message "$BLUE" "📊 View logs:          docker logs -f medswift-app"
print_message "$BLUE" "🛑 Stop services:      docker rm -f medswift-app medswift-redis medswift-mongo"
print_message "$BLUE" "🔄 Restart app:        docker restart medswift-app"
print_message "$BLUE" "📋 Container status:   docker ps"
print_message "$GREEN" "==========================================="
echo ""
print_message "$YELLOW" "💡 Tip: If you see permission errors, you may need to:"
print_message "$YELLOW" "   1. Log out and back in (for group permissions)"
print_message "$YELLOW" "   2. Or run: newgrp docker"
echo ""