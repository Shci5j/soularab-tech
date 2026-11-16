#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

if ! command -v pkg >/dev/null 2>&1; then
  echo "This script must run inside Termux on Android."
  exit 1
fi

MODEL_DIR="${HOME}/.soularab/models"
MODEL_PATH="${ROOH_MODEL_PATH:-$MODEL_DIR/qwen2.5-3b-instruct-q4_k_m.gguf}"
MODEL_URL="https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf"
LLAMA_DIR="${HOME}/.soularab/llama.cpp"
SERVER_BIN="$LLAMA_DIR/build/bin/llama-server"
LOG_FILE="${HOME}/.soularab/llama-server.log"
PORT="${ROOH_LLAMA_PORT:-8081}"
THREADS="${ROOH_THREADS:-4}"
CTX_SIZE="${ROOH_CONTEXT_SIZE:-2048}"

mkdir -p "$MODEL_DIR" "$(dirname "$LOG_FILE")"

if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "ROOH local model server is already running on port $PORT."
  exit 0
fi

pkg update -y
pkg install -y git cmake clang make curl coreutils gawk libandroid-spawn

if [ ! -x "$SERVER_BIN" ]; then
  if [ ! -d "$LLAMA_DIR/.git" ]; then
    git clone --depth 1 https://github.com/ggml-org/llama.cpp.git "$LLAMA_DIR"
  else
    git -C "$LLAMA_DIR" pull --ff-only
  fi
  cmake -S "$LLAMA_DIR" -B "$LLAMA_DIR/build" \
    -DCMAKE_BUILD_TYPE=Release \
    -DGGML_NATIVE=ON \
    -DGGML_OPENMP=OFF \
    -DLLAMA_CURL=OFF
  cmake --build "$LLAMA_DIR/build" --target llama-server -j2
fi

if [ ! -s "$MODEL_PATH" ]; then
  available_kb=$(df -Pk "$HOME" | awk 'NR==2 {print $4}')
  if [ -n "$available_kb" ] && [ "$available_kb" -lt 4000000 ]; then
    echo "At least 4 GB of free storage is required for the 3B model and build."
    exit 1
  fi
  echo "Downloading the Qwen2.5 3B Q4_K_M model (~1.93 GB)..."
  curl -L --fail --retry 3 "$MODEL_URL" -o "$MODEL_PATH"
fi

model_size=$(wc -c < "$MODEL_PATH")
if [ "$model_size" -lt 1500000000 ]; then
  echo "Downloaded model is unexpectedly small; refusing to start."
  exit 1
fi

nohup "$SERVER_BIN" \
  --model "$MODEL_PATH" \
  --alias rooh-local \
  --no-webui \
  --host 127.0.0.1 \
  --port "$PORT" \
  --ctx-size "$CTX_SIZE" \
  --threads "$THREADS" \
  --parallel 1 \
  >"$LOG_FILE" 2>&1 < /dev/null &

echo "Waiting for ROOH local model server..."
for attempt in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "ROOH local model is ready at http://127.0.0.1:$PORT"
    exit 0
  fi
  sleep 1
done

echo "ROOH model server did not become ready. Recent log:"
tail -n 60 "$LOG_FILE" || true
exit 1
