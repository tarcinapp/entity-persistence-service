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
# Use `set -a` and `source` so complex values (JSON, quoted strings, spaces)
# are loaded correctly instead of trying to export line-by-line which breaks
# values that contain spaces or shell-sensitive characters.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Determine port to check and kill any existing process(es) listening on it.
# Default to 3000 when PORT is not set in the env file.
PORT=${PORT:-3000}

get_pids_on_port() {
    local port="$1"
    local pids=""

    if command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -t -i :"$port" 2>/dev/null || true)
    elif command -v ss >/dev/null 2>&1; then
        # Parse pid=1234 from ss output
        pids=$(ss -ltnp "sport = :$port" 2>/dev/null | awk -F'[ ,]+' '/pid=/ {for(i=1;i<=NF;i++){ if($i ~ /^pid=/){ split($i,a,"="); split(a[2],b,","); print b[1] }}}' | sort -u)
    elif command -v netstat >/dev/null 2>&1; then
        pids=$(netstat -ltnp 2>/dev/null | awk -v port=":$port" '$4 ~ port {gsub(/\/.*$/,"",$7); print $7}' | awk -F/ '{print $1}' | sort -u)
    fi

    echo "$pids"
}

echo "Checking for existing process(es) on port $PORT..."
existing_pids=$(get_pids_on_port "$PORT" || true)
if [ -n "$existing_pids" ]; then
    echo "Found existing process(es) on port $PORT: $existing_pids"
    echo "Attempting graceful shutdown of node process(es)..."
    for pid in $existing_pids; do
        if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
            # Only kill if process looks like node
            proc_name=$(ps -p "$pid" -o comm= 2>/dev/null || true)
            if echo "$proc_name" | grep -qiE 'node|nodejs'; then
                echo "Killing PID $pid ($proc_name) ..."
                kill "$pid" 2>/dev/null || true
            else
                echo "Skipping PID $pid ($proc_name) - not a node process"
            fi
        fi
    done

    # Give processes a moment to exit gracefully
    sleep 2
    still_running=$(get_pids_on_port "$PORT" || true)
    if [ -n "$still_running" ]; then
        echo "Processes still running after graceful shutdown: $still_running"
        echo "Forcing kill (SIGKILL) on remaining processes..."
        for pid in $still_running; do
            if [ -n "$pid" ]; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        done
        sleep 1
    fi
else
    echo "No processes found on port $PORT"
fi

# Parse optional detach flag (second arg)
DETACH=false
if [ "$2" = "--detach" ] || [ "$2" = "-d" ]; then
    DETACH=true
fi

# Build the project first
echo "Building the project..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
        echo "Error: Build failed"
        exit 1
fi

# Start the application
if [ "$DETACH" = true ]; then
    echo "Starting the application in background (detached)..."
    # Use nohup so the process continues after this script exits. Save pid and logs.
    nohup node -r source-map-support/register . > server.log 2>&1 &
    echo $! > server.pid
    echo "Server started (detached) with PID $(cat server.pid). Logs: $(pwd)/server.log"
else
    echo "Starting the application..."
    node -r source-map-support/register .
fi
