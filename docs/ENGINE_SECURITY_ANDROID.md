# Engine lifecycle, security, and Android release plan

## 7. Local engine lifecycle

SOULARAB TECH currently integrates three separately hosted local services:
- Ollama: model discovery and chat.
- ComfyUI: image workflow submission and history.
- whisper.cpp: local audio transcription.

The API opens short-lived HTTP clients per operation and closes them after the request. This releases the application's sockets and request resources. It does **not** stop the external daemon: those services may be shared by other local applications, and killing them after each request would be unsafe. Engine process start/stop is therefore delegated to the host's service manager (systemd, Docker Compose, or the platform's service supervisor), not to arbitrary API-supplied shell commands.

Lifecycle contract:
1. Validate a provider URL against the existing loopback/Docker allowlist.
2. Probe only the requested provider when an operation needs it.
3. Open a bounded-time request client for that operation.
4. Close the client in a `finally`-safe context after completion or error.
5. Record non-secret operation metadata in the audit log.
6. Leave provider daemon lifecycle to its explicit host supervisor. Never execute shell text or user-supplied process arguments from an API request.

Model/resource contract:
- Model names must be selected from the provider's current local model inventory.
- No model weights are downloaded automatically.
- No provider URL may point to an arbitrary public host.
- Generation limits and the ComfyUI seven-node allowlist remain mandatory.
- Engine failures are isolated: a failure in one provider must not disable the others.

## 8. Security and stability

Existing controls retained:
- Bearer-token authentication for protected API routes.
- Constant-time token comparison.
- Loopback-only provider URLs, with explicit opt-in for named Docker services.
- CORS origin allowlist.
- Project-scoped file operations; path traversal, symlinks, special files, and unsafe archive entries are rejected.
- Explicit approval and a separate manual execution request; approval alone never executes work.
- Allowlisted execution actions only; no shell, arbitrary code execution, or unrestricted network action.
- Audit events exclude authentication tokens and file contents.
- ZIP import/export and task execution have bounded file/count/size limits.
- Backend runs as an unprivileged container user and persistent data is stored in a volume.

Release checks:
- Run frontend tests and production build.
- Compile Python modules and run backend unittest suite.
- Validate Docker Compose configuration and build application containers.
- Keep secrets in environment variables or GitHub Actions secrets, never in committed files.

## 9. Android packaging

The web client is configured for Capacitor. The Android workflow creates the native Android wrapper during CI, syncs the Vite production build, builds a debug APK, and uploads it as a workflow artifact.

Debug APKs are for installation/testing only. A distributable release APK/AAB must be signed with a private keystore supplied through GitHub Actions secrets. Never commit a keystore, passwords, or signing key.

The app's API base URL must identify a reachable SOULARAB TECH backend. A phone's `127.0.0.1` points to the phone itself, not the computer hosting the backend. For device testing, use a trusted HTTPS backend URL or a private LAN address with the corresponding CORS origin and network access configured. Do not expose Ollama, ComfyUI, whisper.cpp, or the FastAPI port directly to the public internet.

## Device validation checklist

- Install the generated debug APK on a supported Android device.
- Verify launch, Arabic RTL, English LTR, navigation/back behavior, and screen rotation.
- Verify API reachability and authentication using a configured backend URL.
- Verify offline shell behavior separately from backend-dependent features.
- Exercise one request per local provider and confirm errors remain isolated.
- Confirm no API token, keystore, or private key is present in the APK or repository.
