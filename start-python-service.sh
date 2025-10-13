#!/bin/bash

# Python Upload Service Startup Script

echo "Starting Python Upload Service..."

# Check if Python is installed
if ! command -v python &> /dev/null; then
    echo "Error: Python is not installed or not in PATH"
    exit 1
fi

# Check if pip is installed
if ! command -v pip &> /dev/null; then
    echo "Error: pip is not installed or not in PATH"
    exit 1
fi

# Navigate to the Python service directory
cd "$(dirname "$0")/python_upload_service"

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Check if .env file exists in parent directory
if [ ! -f "../.env" ]; then
    echo "Warning: .env file not found in parent directory"
    echo "Please copy .env.example to .env and configure it"
fi

# Start the Flask service
echo "Starting Flask service on port 5000..."
python app.py