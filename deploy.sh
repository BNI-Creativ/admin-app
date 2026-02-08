#!/bin/bash

set -e

if [[ $EUID -eq 0 ]]; then
	echo "❌ Not allowed to run this script as root!"
	exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

setup_files() {
	mkdir -p production/
	cd production/

	# Create necessary directories
	echo "📁 Creating directories..."
	mkdir -p mongodb-data

	cd ..
}

check_preqs() {
	echo "📋 Checking prerequisites..."

	# Check Docker
	if ! command_exists docker; then
		echo "❌ Docker not installed..."
		echo "   Ubuntu/Debian: curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
		exit 1
	fi

	# Check if user is in docker group
	if ! groups $USER | grep -q '\bdocker\b'; then
    		echo "❌ User is not in docker group..."
		echo "   Run: sudo usermod -aG docker $USER"
		echo "   Then re-connect (logout/login)"
		exit 1
	fi
}

build_frontend() {
	cd frontend

	docker run -it --rm --network=host \
		-v $(pwd):/app \
		--user node \
		node:24-alpine \
		sh -c "cd /app/ && npm install --force && npm run build"

	cd ..
	mkdir -p production/
	rm -rf production/frontend/
	mv frontend/build production/frontend
}

build_backend() {
	echo "🏗️  Building and starting services..."
	docker compose up -d --build
}

check_preqs
setup_files

if [ -z "$1" ] ; then
	build_backend
	build_frontend
else
	build_${1}
fi

