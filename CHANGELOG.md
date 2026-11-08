# Changelog

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
