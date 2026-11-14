#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="${SOULARAB_ROOT:-$HOME/soularab-tech}"
cd "$ROOT"

SERVER="${LLAMA_SERVER_BIN:-}"
if [ -z "$SERVER" ]; then
  SERVER="$(command -v llama-server || true)"
fi
if [ -z "$SERVER" ] && [ -x "$HOME/llama.cpp/build/bin/llama-server" ]; then
  SERVER="$HOME/llama.cpp/build/bin/llama-server"
fi
if [ -z "$SERVER" ] || [ ! -x "$SERVER" ]; then
  echo "لم يتم العثور على llama-server. اضبط LLAMA_SERVER_BIN أو ثبّت الملف التنفيذي."
  exit 1
fi

MODEL="${LLAMA_MODEL_PATH:-}"
if [ -z "$MODEL" ]; then
  for candidate in \
    "$ROOT/models/qwen2.5-3b-instruct-q4_k_m.gguf" \
    "$HOME/models/qwen2.5-3b-instruct-q4_k_m.gguf" \
    "$HOME/llama.cpp/models/qwen2.5-3b-instruct-q4_k_m.gguf"; do
    if [ -f "$candidate" ]; then MODEL="$candidate"; break; fi
  done
fi
if [ -z "$MODEL" ] || [ ! -f "$MODEL" ]; then
  echo "لم يتم العثور على نموذج Qwen GGUF."
  echo "اضبط المسار قبل التشغيل: export LLAMA_MODEL_PATH=/المسار/إلى/النموذج.gguf"
  exit 1
fi

HOST="${LLAMA_SERVER_HOST:-127.0.0.1}"
PORT="${LLAMA_SERVER_PORT:-8081}"
BASE="http://$HOST:$PORT"
PID_FILE="$HOME/.soularab-llama-server.pid"
LOG_FILE="$HOME/.soularab-llama-server.log"

engine_is_up() {
  python -c 'import sys,urllib.request; urllib.request.urlopen(sys.argv[1], timeout=2)' "$BASE/health" >/dev/null 2>&1
}

if engine_is_up; then
  echo "llama.cpp يعمل بالفعل على $BASE"
  exit 0
fi

nohup "$SERVER" \
  --model "$MODEL" \
  --alias rooh-local \
  --host "$HOST" \
  --port "$PORT" \
  --ctx-size "${LLAMA_CONTEXT_SIZE:-4096}" \
  --n-gpu-layers "${LLAMA_GPU_LAYERS:-0}" \
  >"$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

for attempt in $(seq 1 40); do
  if python - "$BASE/health" <<'PY' >/dev/null 2>&1
import sys, urllib.request
urllib.request.urlopen(sys.argv[1], timeout=2)
PY
  then
    echo "محرك روح المحلي جاهز: $BASE"
    echo "النموذج: $(basename "$MODEL")"
    echo "السجل: $LOG_FILE"
    exit 0
  fi
  if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "توقف llama-server أثناء الإقلاع. آخر السجل:"
    tail -n 60 "$LOG_FILE" || true
    exit 1
  fi
  sleep 1
done

echo "لم يستجب llama-server خلال 40 ثانية. راجع: $LOG_FILE"
exit 1
