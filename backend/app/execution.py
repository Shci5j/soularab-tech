from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field


class TaskExecutionRequest(BaseModel):
    action: Literal["write_project_note"]
    project_id: int = Field(gt=0)
    filename: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=100_000)


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
                    "description": "يحفظ محتوى نصياً يقدمه المستخدم داخل مساحة مشروع نشطة.",
                    "risk": "low",
                    "requires_project": True,
                    "allowed_extensions": [".txt", ".md"],
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
        if Path(filename).suffix.lower() not in {".txt", ".md"}:
            raise HTTPException(status_code=415, detail="يسمح هذا الإجراء بملفات TXT وMD فقط.")
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
                "بدأ الإجراء المسموح write_project_note.", timestamp,
            )
            db.execute(
                "INSERT INTO audit(action,details,created_at) VALUES(?,?,?)",
                ("task.execution.started", f"المهمة #{task_id}: write_project_note في المشروع #{payload.project_id}.", timestamp),
            )

        try:
            with target.open("x", encoding="utf-8", newline="\n") as output:
                output.write(payload.content)
        except Exception as exc:
            failed_at = main.now()
            with main.database() as db:
                db.execute("UPDATE tasks SET status='failed', updated_at=? WHERE id=? AND status='running'", (failed_at, task_id))
                main.record_task_event(
                    db, task_id, "task.execution.failed", "running", "failed",
                    f"تعذر حفظ الملف: {type(exc).__name__}.", failed_at,
                )
                db.execute(
                    "INSERT INTO audit(action,details,created_at) VALUES(?,?,?)",
                    ("task.execution.failed", f"فشل الإجراء للمهمة #{task_id}: {type(exc).__name__}.", failed_at),
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
                ("task.execution.completed", f"المهمة #{task_id} أنشأت {artifact}.", completed_at),
            )
        return {
            "id": task_id,
            "status": "completed",
            "action": payload.action,
            "artifact": artifact,
            "bytes": len(payload.content.encode("utf-8")),
        }
