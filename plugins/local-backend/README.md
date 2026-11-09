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

These are real embedded HTTP services and a persistent local task queue. They do not yet execute AI inference, image generation, media encoding, code builds, or background jobs. Those require separate on-device engines/workers and must be added per node. Android may stop the app process in the background; this plugin intentionally stops servers when the application process is destroyed and does not claim an always-on Android foreground service.
