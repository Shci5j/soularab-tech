# Secure Control Gateway — Phase 1

## Scope

This phase adds a native, read-only snapshot API to the Android Capacitor plugin. It is a local capability boundary for later integration; it is not yet a remote-control service or an MCP server.

## API

- Native method: `LocalBackend.readOnlyControlSnapshot()`
- Returns the embedded A–E node status and non-sensitive Rooh engine status.
- Does not return the local node access token or the model's private filesystem path.
- Does not execute shell commands, enqueue tasks, start/stop nodes, or change application data.
- Explicitly reports `shellExecution: false` and `remoteTransport: false`.

## Security boundary

The method is callable by the app's own Capacitor JavaScript bridge. It must not be exposed through an HTTP route or external listener. A future remote transport must use outbound authenticated encrypted connections, a narrowly scoped command allowlist, expiring authorization, and explicit approval for every state-changing action.

## Not included in this phase

- No relay server, public listener, SSH exposure, or MCP endpoint.
- No Termux shell execution or command-output capture.
- No task dispatch, file modification, model loading, or node lifecycle controls.
- No changes to `main` or existing pull requests.

## Verification required

Build the Android app and call `readOnlyControlSnapshot()` on-device. Confirm that the returned object contains no access token and that calling it leaves node state, task queues, and application files unchanged.
