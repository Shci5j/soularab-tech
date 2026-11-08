# Changelog

## 0.11.0 — 2026-11-08

- Added an allowlisted task execution registry with the `write_project_note` action.
- Added explicit execution for queued tasks, with approval checks for tasks linked to approval requests.
- Added task event and audit records for execution start, completion, and failure.
- Added agents-workspace controls for selecting an active project, editing the output filename and content, and starting the action manually.
- Restricted generated artifacts to TXT and MD files inside an active project workspace. No shell commands, arbitrary code execution, automatic task execution, or external network actions were introduced.
