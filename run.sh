#!/bin/bash

# Set error handling
set -e

# Directory of the script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if virtual environment exists, if not create it
if [ ! -d "$DIR/.venv" ]; then
  echo "Virtual environment not found. Creating..."
  python3 -m venv "$DIR/.venv"
fi

# Use uv to install requirements into the virtual environment
echo "Installing requirements using uv..."
uv pip install -r requirements.txt --python "$DIR/.venv/bin/python"

# Run the main script using the virtual environment's python
echo "Running the application..."
"$DIR/.venv/bin/python" "$DIR/src_py/main.py"