from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field


class TaskExecutionRequest(BaseModel):
    action: Literal["write_project_note", "export_project_inventory"]
    project_id: int = Field(gt=0)
    filename: str = Field(min_length=1, max_length=120)
    content: str = Field(default="", max_length=100_000)


def register_execution_routes(app) -> None:
    # Import at registration time to avoid a module import cycle with main.py.
    from . import main

    @app.get("/api/executions/registry")
    def execution_registry(_: None = Depends(main.require_access)):
        return {
            "items": [
                {
                    "id": "write_project_note",
                    "title": "إنشاء ملف نصي داخل مشروع",
                    "title_en": "Create a project text file",
                    "description": "يحفظ محتوى نصياً يقدمه المستخدم داخل مساحة مشروع نشطة.",
                    "description_en": "Save user-provided text in an active project workspace.",
                    "risk": "low",
                    "requires_project": True,
                    "allowed_extensions": [".txt", ".md"],
                },
                {
                    "id": "export_project_inventory",
                    "title": "تصدير فهرس ملفات المشروع",
                    "title_en": "Export project file inventory",
                    "description": "ينشئ تقرير Markdown بأسماء الملفات العادية وأحجامها وتواريخ تعديلها، دون قراءة محتوياتها أو تضمين الملفات المخفية والأسرار والروابط الرمزية.",
                    "description_en": "Create a Markdown report of regular file names, sizes, and modification times without reading file contents or including hidden files, credentials, or symlinks.",
                    "risk": "low",
                    "requires_project": True,
                    "allowed_extensions": [".md"],
                }
            ],
            "policy": "allowlist_only",
        }

    @app.post("/api/tasks/{task_id}/execute")
    def execute_task(
        task_id: int,
        payload: TaskExecutionRequest,
        _: None = Depends(main.require_access),
    ):
        # Resolve and validate the destination before claiming the task.
        root = main.project_workspace(payload.project_id, require_active=True)
        filename = main.safe_filename(payload.filename)
        suffix = Path(filename).suffix.lower()
        if payload.action == "write_project_note":
            if not payload.content.strip():
                raise HTTPException(status_code=422, detail="محتوى الملاحظة مطلوب.")
            if suffix not in {".txt", ".md"}:
                raise HTTPException(status_code=415, detail="يسمح إجراء الملاحظة بملفات TXT وMD فقط.")
            artifact_content = payload.content
        else:
            if suffix != ".md":
                raise HTTPException(status_code=415, detail="يسمح فهرس المشروع بملف Markdown فقط.")
            with main.database() as db:
                project = db.execute("SELECT title, description FROM projects WHERE id=? AND status='active'", (payload.project_id,)).fetchone()
            if project is None:
                raise HTTPException(status_code=404, detail="المشروع النشط غير موجود.")
            entries = []
            truncated = False
            sensitive_suffixes = {".pem", ".key", ".p12", ".pfx", ".keystore"}
            for current, directories, names in os.walk(root, followlinks=False):
                current_path = Path(current)
                directories[:] = [
                    name for name in directories
                    if not name.startswith(".") and not (current_path / name).is_symlink()
                ]
                for name in names:
                    item = current_path / name
                    if name.startswith(".") or item.is_symlink() or not item.is_file():
                        continue
                    if item.suffix.lower() in sensitive_suffixes or any(marker in name.lower() for marker in ("credential", "secret", "token", "private")) or name.lower() in {"id_rsa", "id_ed25519"}:
                        continue
                    try:
                        resolved = item.resolve(strict=True)
                        if not resolved.is_relative_to(root):
                            continue
                        stat_result = item.stat()
                    except (OSError, RuntimeError):
                        continue
                    modified = main.datetime.fromtimestamp(stat_result.st_mtime, main.timezone.utc).isoformat()
                    entries.append((resolved.relative_to(root).as_posix(), stat_result.st_size, modified))
                    if len(entries) > 200:
                        truncated = True
                        break
                if truncated:
                    break
            entries = entries[:200]
            lines = [
                f"# فهرس المشروع: {project['title']}",
                "",
                project["description"] or "تقرير آلي لملفات مساحة المشروع.",
                "",
                "| الملف | الحجم (بايت) | آخر تعديل (UTC) |",
                "|---|---:|---|",
            ]
            for relative, size, modified in entries:
                safe_name = relative.replace("|", "\\|").replace("\n", " ")
                lines.append(f"| {safe_name} | {size} | {modified} |")
            if not entries:
                lines.append("| لا توجد ملفات عادية قابلة للفهرسة | 0 | — |")
            if truncated:
                lines.extend(["", "ملاحظة: عُرض أول 200 ملف فقط."])
            lines.extend(["", "ملاحظة أمان: لا يتضمن هذا التقرير محتويات الملفات أو الملفات المخفية أو مفاتيح التشفير أو الروابط الرمزية."])
            artifact_content = "\n".join(lines) + "\n"

        target = (root / filename).resolve()
        if target.parent != root or target.exists():
            raise HTTPException(status_code=409, detail="الملف موجود مسبقاً أو أن مساره غير مسموح.")

        timestamp = main.now()
        with main.database() as db:
            task = db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
            if task is None:
                raise HTTPException(status_code=404, detail="المهمة غير موجودة.")
            if task["status"] != "queued":
                raise HTTPException(status_code=409, detail="لا يمكن تنفيذ المهمة إلا إذا كانت في قائمة الانتظار.")
            approval = db.execute("SELECT status FROM approvals WHERE task_id=?", (task_id,)).fetchone()
            if approval is not None and approval["status"] != "approved":
                raise HTTPException(status_code=403, detail="يجب اعتماد المهمة قبل تنفيذها.")
            changed = db.execute(
                "UPDATE tasks SET status='running', updated_at=? WHERE id=? AND status='queued'",
                (timestamp, task_id),
            ).rowcount
            if changed != 1:
                raise HTTPException(status_code=409, detail="بدأ تنفيذ المهمة بالفعل أو تغيرت حالتها.")
            main.record_task_event(
                db, task_id, "task.execution.started", "queued", "running",
                f"بدأ الإجراء المسموح {payload.action}.", timestamp,
            )
            db.execute(
                "INSERT INTO audit(action,details,created_at) VALUES(?,?,?)",
                ("task.execution.started", f"المهمة #{task_id}: write_project_note في المشروع #{payload.project_id}.", timestamp),
            )

        created_artifact = False
        try:
            # Exclusive creation prevents overwriting an existing file. If writing
            # fails midway, remove only the regular file created by this request.
            with target.open("x", encoding="utf-8", newline="\n") as output:
                created_artifact = True
                output.write(artifact_content)
        except Exception as exc:
            if created_artifact:
                try:
                    if target.is_file() and not target.is_symlink():
                        target.unlink()
                except OSError:
                    # Preserve the original execution failure; the task is still
                    # marked failed and the audit trail records the exception.
                    pass
            failed_at = main.now()
            with main.database() as db:
                db.execute("UPDATE tasks SET status='failed', updated_at=? WHERE id=? AND status='running'", (failed_at, task_id))
                main.record_task_event(
                    db, task_id, "task.execution.failed", "running", "failed",
                    f"تعذر حفظ الملف: {type(exc).__name__}.", failed_at,
                )
                db.execute(
                    "INSERT INTO audit(action,details,created_at) VALUES(?,?,?)",
                    ("task.execution.failed", f"فشل الإجراء {payload.action} للمهمة #{task_id}: {type(exc).__name__}.", failed_at),
                )
            raise HTTPException(status_code=500, detail="تعذر حفظ الملف داخل مساحة المشروع؛ سُجل فشل المهمة.") from exc

        completed_at = main.now()
        artifact = f"workspaces/{payload.project_id}/{filename}"
        with main.database() as db:
            db.execute("UPDATE tasks SET status='completed', updated_at=? WHERE id=? AND status='running'", (completed_at, task_id))
            main.record_task_event(
                db, task_id, "task.execution.completed", "running", "completed",
                f"حُفظ الملف {filename} في المشروع #{payload.project_id}.", completed_at,
            )
            db.execute(
                "INSERT INTO audit(action,details,created_at) VALUES(?,?,?)",
                ("task.execution.completed", f"المهمة #{task_id} نفذت {payload.action} وأنشأت {artifact}.", completed_at),
            )
        return {
            "id": task_id,
            "status": "completed",
            "action": payload.action,
            "artifact": artifact,
            "bytes": len(artifact_content.encode("utf-8")),
        }
