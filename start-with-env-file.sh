#!/bin/bash

# Script to start the entity-persistence-service with environment variables from a specified file

# Check if env file path is provided as parameter
if [ $# -eq 0 ]; then
    echo "Usage: $0 <env-file-path>"
    echo "Example: $0 dev.env"
    exit 1
fi

ENV_FILE="$1"

# Check if the specified env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file '$ENV_FILE' not found"
    exit 1
fi

# Export environment variables from the specified env file
echo "Loading environment variables from $ENV_FILE..."
export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

# Build the project first
echo "Building the project..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "Error: Build failed"
    exit 1
fi

# Start the application
echo "Starting the application..."
node -r source-map-support/register .
