#!/usr/bin/env bash
# SilverNinja Games - Quick Start Script (serves the hub and every game repo cloned next to it)

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "Starting SilverNinja Games..."

if command -v python3 &> /dev/null; then
    python3 server.py
elif command -v open &> /dev/null; then
    open index.html
else
    echo "Please open index.html in your web browser."
fi
