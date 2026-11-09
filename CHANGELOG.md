## 0.17.0 — 2026-11-09

- Add Capacitor Android project configuration and a reproducible GitHub Actions debug-APK build workflow.
- Keep Android signing credentials out of source control; release signing is gated on repository secrets.
- Document engine lifecycle boundaries, local-only provider contracts, resource release, and Android backend connectivity requirements.

# Changelog

## 0.16.3 — 2026-11-09

- Validate the backend API base URL before every request that may include the bearer token; allow HTTPS and local loopback HTTP only.
- Reject embedded URL credentials, query strings, fragments, and non-root paths to prevent sending access tokens to arbitrary insecure endpoints.
- Add Node built-in URL security tests and run them in CI before the frontend production build.
- Translate common Arabic backend error details for English-mode users while preserving Arabic-mode responses.

## 0.16.2 — 2026-11-09

- Add a persisted default Ollama chat temperature preference (0.0–2.0), validated by the backend and included in settings backup/restore.
- Add a localized keyboard skip-navigation link to move directly to the main content.
- Preserve the lower fixed temperature used for task-planning prompts.

## 0.16.1 — 2026-11-09

- Make the backend execution registry the source of truth for available manual actions in the Agents interface.
- Load localized Arabic/English action names and descriptions dynamically and disable execution until the registry is available.
- Add registry contract tests to keep frontend and backend action metadata synchronized.

## 0.16.0 — 2026-11-09

- Add a safe project inventory Markdown export that reports file metadata only and excludes hidden files, symlinks, and common credentials.
- Connect the inventory export to the manual agent execution interface and task audit trail.
- Restrict ComfyUI requests to a bounded seven-node image-generation workflow with validated node references and parameter limits.
- Localize common interface feedback, upload/download progress, and repository errors in English mode.
- Add an authenticated security posture endpoint and a Security center panel that accurately identifies the shared-token model and missing individual-account features without exposing secrets.

# Changelog

## 0.15.0 — 2026-11-09

- Expanded settings backup and restore for interface preferences, date format, time zone, and trusted backend URL while excluding authentication secrets.
- Added a persistent high-contrast accessibility mode with stronger text, borders, and keyboard focus visibility in dark and light themes.
- Added a default local Ollama text model preference shared by assistant chat and AI-assisted drafting, with backup and restore support.
- Added an optional browser-session inactivity lock that clears the access token after 15, 30, or 60 minutes and requires re-authentication.
- Added configurable dashboard refresh intervals and retained device-local settings behavior.

## 0.14.2 — 2026-11-09

- Completed English translations for the workspace access dialog and primary navigation accessibility label.
- Localized audit-log empty state and timestamps to the selected interface language.


## 0.14.1 — 2026-11-09

- Improved safe task execution: if writing a project note fails after creating a partial file, the executor removes that incomplete artifact before marking the task failed.
- Added a regression test proving partial output is removed and the task failure is recorded.


## 0.14.0 — 2026-11-09

- Added authenticated project restoration from ZIP archives, creating a new active workspace without overwriting existing projects.
- Validated archive metadata, filenames, file types, duplicate entries, and compressed/unpacked size limits; rejected traversal, symlinks, special files, and encrypted entries.
- Added safe per-file restoration with rollback cleanup, audit logging, and regression tests for valid imports and malicious archive entries.
- Added Arabic/English project archive import controls.


## 0.13.0 — 2026-11-09

- Added authenticated ZIP export for active and archived project workspaces, including project metadata in `project.json`.
- Excluded symlinks and non-regular files from archives, with a 200-file and 50 MB export limit.
- Added audit logging and regression tests for archive contents, symlink exclusion, and production authentication.
- Added project-card export controls in Arabic and English.


## 0.12.0 — 2026-11-09

- Added explicit project file deletion through the authenticated API.
- Restricted deletion to regular files directly inside active project workspaces; symlinks, path traversal, missing files, and archived projects are rejected.
- Added a confirmation step and delete action in Files & Projects.
- Added audit records and backend tests for successful deletion and missing-file behavior.
- Corrected project create/archive audit labels and allowed DELETE in the configured CORS methods.


## 0.11.0 — 2026-11-08

- Added an allowlisted task execution registry with the `write_project_note` action.
- Added explicit execution for queued tasks, with approval checks for tasks linked to approval requests.
- Added task event and audit records for execution start, completion, and failure.
- Added agents-workspace controls for selecting an active project, editing the output filename and content, and starting the action manually.
- Restricted generated artifacts to TXT and MD files inside an active project workspace. No shell commands, arbitrary code execution, automatic task execution, or external network actions were introduced.
