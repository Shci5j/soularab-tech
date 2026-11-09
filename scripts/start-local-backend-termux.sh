#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

if ! command -v pkg >/dev/null 2>&1; then
  echo "This setup script must run inside Termux on Android."
  exit 1
fi

if [ ! -f "backend/app/main.py" ] || [ ! -f "backend/requirements.txt" ]; then
  echo "Run this script from the root of the SOULARAB TECH repository."
  exit 1
fi

pkg update -y
pkg install -y python clang make rust
python -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r backend/requirements.txt

export PYTHONPATH="$PWD/backend"
export SOULARAB_ENV=local
export SOULARAB_DATA_DIR="$HOME/.soularab/data"
export SOULARAB_CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,https://localhost,capacitor://localhost"
mkdir -p "$SOULARAB_DATA_DIR"

echo
echo "SOULARAB TECH local API is starting at http://127.0.0.1:8000"
echo "Keep this Termux session open while using the app."
exec python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
