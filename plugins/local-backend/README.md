# SOULARAB TECH — Embedded Android Department Runtime

The Capacitor Android plugin starts five independent HTTP listeners bound only to `127.0.0.1`:

| Node | Port | Owner | Worker capability |
|---|---:|---|---|
| A | 3101 | ROOH orchestration | Local Qwen plan drafting through the native llama.cpp runtime |
| B | 3102 | AI and text | Local Qwen text task execution through the native llama.cpp runtime |
| C | 3103 | Image and design | ComfyUI API adapter for built-in image workflows |
| D | 3104 | Audio and speech | whisper.cpp HTTP adapter for audio transcription |
| E | 3105 | Development and recovery | Allowlisted app-private workspace file creation; no shell or code execution |

All nodes share the app-private SQLite database with WAL enabled. A task is eligible for a worker only when it is `queued` and has a linked `node_approvals` row in `approved` state. Workers claim tasks with a conditional state update, write task results, and append start/completion/failure events. Rejected tasks are cancelled and are never picked up.

## Local engine prerequisites

- **A and B:** bundled llama.cpp JNI runtime plus the Qwen2.5-3B-Instruct Q4_K_M GGUF model. Download/load the model from the app before submitting model-backed tasks.
- **C:** ComfyUI must be running on the same Android device at `http://127.0.0.1:8188` by default. Configure another loopback port with `LocalBackend.configureLocalEngine({ engine: 'comfyui', baseUrl: 'http://127.0.0.1:8188' })`. The adapter accepts ComfyUI API prompt graphs containing built-in node types only; custom nodes are rejected. It polls the prompt history for completion.
- **D:** whisper.cpp server must be running on the same Android device at `http://127.0.0.1:8080` by default. Configure it with `LocalBackend.configureLocalEngine({ engine: 'whisper', baseUrl: 'http://127.0.0.1:8080' })`. Audio tasks must contain `audioBase64`, an optional safe filename, and optional language code. Audio payloads are bounded; the adapter does not transcode video or claim video generation.
- **E:** `write_note` and `write_artifact` tasks may create new TXT, MD, JSON, HTML, CSS, JS, or PY files below the app-private `soularab-workspaces/<workspaceId>` directory. Existing files are never overwritten. Paths are canonicalized and traversal is rejected. Shell execution, terminal commands, deployment, network access, deletion, and arbitrary code execution are not part of this worker.

The local media adapters never accept public or LAN URLs. Their configured endpoints must use HTTP loopback hosts only. Use `LocalBackend.localEngineStatus()` to check ComfyUI and whisper.cpp health. An online HTTP endpoint proves service reachability, not that its model/checkpoint is installed or that a task succeeded.

## Queue lifecycle and recovery

1. Node E creates a task and its pending approval in one SQLite transaction.
2. An explicit approval decision changes the task to `queued`; rejection changes it to `cancelled`.
3. The owning node worker selects only queued tasks with an approved linked approval.
4. A conditional update claims the task as `running`.
5. The worker records `task_started`, then either `task_completed` or `task_failed` with a bounded result.
6. On plugin startup, interrupted inference/transcription tasks on A, B, and D are requeued. C (media generation) and E (file creation) are marked failed for manual review instead of being blindly repeated, preventing duplicate media jobs or file side effects. A recovery event records both counts. This is process-restart recovery, not a guarantee of uninterrupted background execution.

## Security and operational limits

- Each HTTP node binds to loopback and requires the per-install `X-Local-Token`.
- The worker adapters do not invoke a shell and do not contact cloud inference APIs.
- ComfyUI graphs are restricted to a built-in node allowlist; custom nodes are not accepted.
- E writes only new files within app-private storage and refuses overwrites.
- The app currently uses worker threads, not an Android foreground service. Android may stop the process in the background; do not treat this as an always-on server.
- CI compilation does not prove a physical-device run. A real Android acceptance test must install the APK, load Qwen, start the local media services where applicable, submit and approve test tasks, verify completed results, then force-stop/restart the app and verify recovery.

## Install and build

```sh
npm install
npx cap sync android
npm run build
cd android
./gradlew assembleDebug
``

The plugin is an adapter framework, not a bundle of ComfyUI or whisper.cpp. Those media runtimes, their model files, and their device resource requirements must be installed separately on the same Android device before C or D can execute real media tasks.
