from __future__ import annotations

import os
import secrets
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("SOULARAB_DATA_DIR", ROOT / "data")).expanduser()
DB_PATH = DATA_DIR / "soularab.sqlite3"
VERSION = "0.1.0"
API_TOKEN = os.getenv("SOULARAB_API_TOKEN", "").strip()
APP_ENV = os.getenv("SOULARAB_ENV", "local").lower()
ALLOWED_ORIGINS = [v.strip() for v in os.getenv("SOULARAB_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if v.strip()]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


@asynccontextmanager
async def _unused_async_context():
    yield


from contextlib import contextmanager


@contextmanager
def database():
    db = connect()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    with database() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            risk TEXT NOT NULL CHECK(risk IN ('low','medium','high')),
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
            created_at TEXT NOT NULL,
            decided_at TEXT,
            decision_note TEXT
        );
        CREATE TABLE IF NOT EXISTS audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            details TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """)


def audit(action: str, details: str) -> None:
    with database() as db:
        db.execute("INSERT INTO audit(action, details, created_at) VALUES(?,?,?)", (action, details[:2000], now()))


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    audit("backend.started", f"الخادم بدأ في وضع {APP_ENV}")
    yield


app = FastAPI(
    title="SOULARAB TECH API",
    description="Local-first API foundation. External providers are disabled unless explicitly configured.",
    version=VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def require_access(authorization: str | None = Header(default=None)) -> None:
    if not API_TOKEN:
        if APP_ENV == "production":
            raise HTTPException(status_code=503, detail="SOULARAB_API_TOKEN must be configured in production.")
        return
    scheme, _, supplied = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(supplied, API_TOKEN):
        raise HTTPException(status_code=401, detail="رمز الوصول غير صحيح أو غير موجود.")


class ApprovalCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=5, max_length=2000)
    risk: Literal["low", "medium", "high"] = "medium"


class ApprovalDecision(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=1000)


def row_dict(row: sqlite3.Row) -> dict:
    return dict(row)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": VERSION, "mode": APP_ENV, "external_connections": "disabled_by_default"}


@app.get("/api/capabilities")
def capabilities():
    return {
        "modules": ["assistant", "web", "design", "media", "apps", "files", "agents", "domains", "security"],
        "providers": {"ollama": "not_connected", "llama_cpp": "not_connected", "comfyui": "not_connected", "whisper_cpp": "not_connected"},
        "policy": {"external_network": "opt_in", "mutations": "explicit_approval", "execution_after_approval": "separate_action"},
    }


@app.get("/api/approvals")
def list_approvals(status: Literal["pending", "approved", "rejected"] | None = None, _: None = Depends(require_access)):
    with database() as db:
        if status:
            rows = db.execute("SELECT * FROM approvals WHERE status=? ORDER BY id DESC LIMIT 100", (status,)).fetchall()
        else:
            rows = db.execute("SELECT * FROM approvals ORDER BY id DESC LIMIT 100").fetchall()
    return {"items": [row_dict(row) for row in rows]}


@app.post("/api/approvals", status_code=201)
def create_approval(payload: ApprovalCreate, _: None = Depends(require_access)):
    with database() as db:
        cursor = db.execute(
            "INSERT INTO approvals(title,description,risk,status,created_at) VALUES(?,?,?,'pending',?)",
            (payload.title, payload.description, payload.risk, now()),
        )
        approval_id = cursor.lastrowid
    audit("approval.created", f"طلب #{approval_id}: {payload.title}")
    return {"id": approval_id, "status": "pending", "execution": "not_started"}


@app.post("/api/approvals/{approval_id}/decision")
def decide_approval(approval_id: int, payload: ApprovalDecision, _: None = Depends(require_access)):
    with database() as db:
        row = db.execute("SELECT * FROM approvals WHERE id=?", (approval_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="طلب الموافقة غير موجود.")
        if row["status"] != "pending":
            raise HTTPException(status_code=409, detail="تم اتخاذ قرار بشأن هذا الطلب مسبقاً.")
        db.execute(
            "UPDATE approvals SET status=?, decided_at=?, decision_note=? WHERE id=?",
            (payload.decision, now(), payload.note, approval_id),
        )
    audit(f"approval.{payload.decision}", f"طلب #{approval_id}. لم يتم تنفيذ الإجراء.")
    return {"id": approval_id, "status": payload.decision, "execution": "not_started"}


@app.get("/api/audit")
def get_audit(limit: int = Query(default=30, ge=1, le=100), _: None = Depends(require_access)):
    with database() as db:
        rows = db.execute("SELECT * FROM audit ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return {"items": [row_dict(row) for row in rows]}


@app.get("/")
def root():
    return {"service": "SOULARAB TECH API", "docs": "/docs", "health": "/api/health"}
