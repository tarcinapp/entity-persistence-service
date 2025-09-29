#!/bin/bash

# Script to start the entity-persistence-service with dev.env environment variables

# Check if dev.env file exists
if [ ! -f "dev.env" ]; then
    echo "Error: dev.env file not found in the current directory"
    exit 1
fi

# Export environment variables from dev.env file
echo "Loading environment variables from dev.env..."
export $(grep -v '^#' dev.env | grep -v '^$' | xargs)

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
