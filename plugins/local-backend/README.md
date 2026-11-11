# SOULARAB Embedded Local Backend

This Capacitor 6 Android plugin starts five independent HTTP server instances bound only to 127.0.0.1:

| Node | Port | Responsibility |
|---|---:|---|
| A | 3101 | AI and text task queue |
| B | 3102 | Image and design task queue |
| C | 3103 | Audio and video task queue |
| D | 3104 | Development task queue |
| E | 3105 | Scheduling, routing and recovery status |

All nodes persist their queues in the app-private Android SQLite database. Node E exposes `GET /nodes` and `POST /dispatch`; task types are routed to the relevant node queue. Each node exposes `GET /health`, `GET /metrics`, `GET /tasks`, `POST /tasks`, and task lookup. The local section store is also available through `GET/POST /sections`.

Requests must include the `X-Local-Token` returned by the Capacitor `start()` method. The servers accept Capacitor localhost origins only and bind to loopback.

## Install and sync

The root app depends on this package through a local file dependency. Run:

```sh
npm install
npx cap sync android
```

The Android project must be generated with `npx cap add android` if it does not exist yet.

## Scope

The plugin now bundles the llama.cpp v0.9.0 native runtime for arm64 Android through the Android NDK and JNI. The ROOH text assistant and the AI/text task worker use this in-process native runtime; they do not call Ollama, Termux, localhost model servers, or cloud inference. On first use, the app downloads the Qwen2.5-3B-Instruct Q4_K_M GGUF model into private app storage (about 2 GB; allow at least 2.8 GB free). After the one-time download, text inference is fully offline. The five HTTP nodes remain local orchestration/department APIs; image generation, speech/video processing, and development builds still require their own real on-device engines and are not provided by llama.cpp. Android may stop the app process in the background; the plugin does not claim an always-on Android foreground service.
