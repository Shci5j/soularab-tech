from __future__ import annotations

import ipaddress
import os
import re
import secrets
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from typing import Literal

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
import httpx
from pydantic import BaseModel, Field, field_validator

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("SOULARAB_DATA_DIR", ROOT / "data")).expanduser()
DB_PATH = DATA_DIR / "soularab.sqlite3"
VERSION = "0.7.0"
API_TOKEN = os.getenv("SOULARAB_API_TOKEN", "").strip()
APP_ENV = os.getenv("SOULARAB_ENV", "local").lower()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "90"))
ALLOW_DOCKER_OLLAMA = os.getenv("SOULARAB_ALLOW_DOCKER_OLLAMA", "").lower() == "true"
ALLOW_DOCKER_MEDIA = os.getenv("SOULARAB_ALLOW_DOCKER_MEDIA", "").lower() == "true"
COMFYUI_BASE_URL = os.getenv("COMFYUI_BASE_URL", "http://127.0.0.1:8188").rstrip("/")
WHISPER_CPP_BASE_URL = os.getenv("WHISPER_CPP_BASE_URL", "http://127.0.0.1:8080").rstrip("/")
MEDIA_TIMEOUT = float(os.getenv("SOULARAB_MEDIA_TIMEOUT_SECONDS", "180"))
MAX_AUDIO_BYTES = 25 * 1024 * 1024
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac", ".mp4", ".mpeg", ".mpga"}
ALLOWED_ORIGINS = [v.strip() for v in os.getenv("SOULARAB_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if v.strip()]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


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
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
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


class ProjectCreate(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=1000)


class ApprovalCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=5, max_length=2000)
    risk: Literal["low", "medium", "high"] = "medium"


class ApprovalDecision(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=1000)


def validate_local_provider_url(value: str) -> str:
    """Allow only loopback Ollama endpoints; prevents accidental remote access."""
    parsed = urlparse(value)
    if parsed.scheme != "http" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("OLLAMA_BASE_URL must be a plain HTTP loopback URL.")
    host = parsed.hostname.lower()
    if host == "localhost" or (host == "ollama" and ALLOW_DOCKER_OLLAMA):
        return value.rstrip("/")
    try:
        address = ipaddress.ip_address(host)
    except ValueError as exc:
        raise ValueError("Only localhost or a loopback IP is allowed for Ollama.") from exc
    if not address.is_loopback:
        raise ValueError("Only localhost or a loopback IP is allowed for Ollama.")
    return value.rstrip("/")

try:
    OLLAMA_BASE_URL = validate_local_provider_url(OLLAMA_BASE_URL)
except ValueError as exc:
    raise RuntimeError(str(exc)) from exc


def validate_local_media_url(value: str, variable: str) -> str:
    """Media engines are local-only unless a Docker service alias is explicitly enabled."""
    parsed = urlparse(value)
    if parsed.scheme != "http" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError(f"{variable} must be a plain HTTP local URL.")
    host = parsed.hostname.lower()
    if host == "localhost" or (host in {"comfyui", "whisper"} and ALLOW_DOCKER_MEDIA):
        return value.rstrip("/")
    try:
        address = ipaddress.ip_address(host)
    except ValueError as exc:
        raise ValueError(f"{variable} must point to localhost or a loopback IP.") from exc
    if not address.is_loopback:
        raise ValueError(f"{variable} must point to localhost or a loopback IP.")
    return value.rstrip("/")


try:
    COMFYUI_BASE_URL = validate_local_media_url(COMFYUI_BASE_URL, "COMFYUI_BASE_URL")
    WHISPER_CPP_BASE_URL = validate_local_media_url(WHISPER_CPP_BASE_URL, "WHISPER_CPP_BASE_URL")
except ValueError as exc:
    raise RuntimeError(str(exc)) from exc

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)

class ChatRequest(BaseModel):
    model: str = Field(min_length=1, max_length=120)
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)
    temperature: float = Field(default=0.7, ge=0, le=2)

async def ollama_request(path: str, payload: dict | None = None):
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            response = await client.request("POST" if payload is not None else "GET", OLLAMA_BASE_URL + path, json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=503, detail="خدمة Ollama المحلية غير متصلة. شغّل Ollama على جهاز الخادم.") from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="انتهت مهلة انتظار النموذج المحلي.") from exc
    except httpx.HTTPStatusError as exc:
        detail = "تعذر على Ollama إكمال الطلب."
        try:
            detail = exc.response.json().get("error", detail)
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=str(detail)[:500]) from exc
    except (ValueError, httpx.DecodingError) as exc:
        raise HTTPException(status_code=502, detail="أعاد مزود النموذج استجابة غير صالحة.") from exc

def row_dict(row: sqlite3.Row) -> dict:
    return dict(row)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": VERSION, "mode": APP_ENV, "external_connections": "disabled_by_default"}


@app.get("/api/assistant/status")
async def assistant_status(_: None = Depends(require_access)):
    try:
        data = await ollama_request("/api/version")
        return {"provider": "ollama", "connected": True, "version": data.get("version")}
    except HTTPException as exc:
        if exc.status_code == 503:
            return {"provider": "ollama", "connected": False, "message": exc.detail}
        raise

@app.get("/api/assistant/models")
async def assistant_models(_: None = Depends(require_access)):
    data = await ollama_request("/api/tags")
    models = [{"name": item.get("name"), "size": item.get("size"), "modified_at": item.get("modified_at")} for item in data.get("models", []) if item.get("name")]
    return {"provider": "ollama", "items": models}

@app.post("/api/assistant/chat")
async def assistant_chat(payload: ChatRequest, _: None = Depends(require_access)):
    models = await ollama_request("/api/tags")
    available = {item.get("name") for item in models.get("models", [])}
    if payload.model not in available:
        raise HTTPException(status_code=404, detail="النموذج المحدد غير موجود في Ollama المحلية.")
    response = await ollama_request("/api/chat", {"model": payload.model, "messages": [message.model_dump() for message in payload.messages], "stream": False, "options": {"temperature": payload.temperature}})
    message = response.get("message", {})
    content = message.get("content", "")
    if not content:
        raise HTTPException(status_code=502, detail="لم يُرجع النموذج محتوى.")
    audit("assistant.chat", "نموذج محلي: " + payload.model + "؛ عدد الرسائل: " + str(len(payload.messages)))
    return {"model": payload.model, "message": {"role": "assistant", "content": content}, "done": True}

@app.get("/api/capabilities")
def capabilities():
    return {
        "modules": ["assistant", "web", "design", "media", "apps", "files", "agents", "domains", "security"],
        "providers": {"ollama": "local_loopback_opt_in", "llama_cpp": "not_connected", "comfyui": "local_loopback_opt_in", "whisper_cpp": "local_loopback_opt_in"},
        "policy": {"external_network": "opt_in", "mutations": "explicit_approval", "execution_after_approval": "separate_action"},
    }



class ImageWorkflowRequest(BaseModel):
    workflow: dict
    client_id: str | None = Field(default=None, max_length=100)

    @field_validator("workflow")
    @classmethod
    def require_non_empty_workflow(cls, value: dict) -> dict:
        if not value:
            raise ValueError("workflow must contain at least one node")
        return value


async def media_get(base_url: str, path: str):
    try:
        async with httpx.AsyncClient(timeout=MEDIA_TIMEOUT) as client:
            response = await client.get(base_url + path)
            response.raise_for_status()
            return response.json()
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=503, detail="محرك الوسائط المحلي غير متصل. تحقق من تشغيل الخدمة على جهاز الخادم.") from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="انتهت مهلة انتظار محرك الوسائط المحلي.") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"رفض محرك الوسائط الطلب ({exc.response.status_code}).") from exc
    except (ValueError, httpx.DecodingError) as exc:
        raise HTTPException(status_code=502, detail="أعاد محرك الوسائط استجابة غير صالحة.") from exc


@app.get("/api/media/image/status")
async def image_engine_status(_: None = Depends(require_access)):
    try:
        stats = await media_get(COMFYUI_BASE_URL, "/system_stats")
        return {"provider": "comfyui", "connected": True, "system": stats}
    except HTTPException as exc:
        if exc.status_code == 503:
            return {"provider": "comfyui", "connected": False, "message": exc.detail}
        raise



@app.get("/api/media/image/models")
async def image_engine_models(_: None = Depends(require_access)):
    info = await media_get(COMFYUI_BASE_URL, "/object_info/CheckpointLoaderSimple")
    node = info.get("CheckpointLoaderSimple", {}) if isinstance(info, dict) else {}
    required = node.get("input", {}).get("required", {}) if isinstance(node, dict) else {}
    options = required.get("ckpt_name", [[]])
    models = options[0] if options and isinstance(options[0], list) else []
    return {"provider": "comfyui", "models": [name for name in models if isinstance(name, str)]}


@app.post("/api/media/image/queue")
async def queue_image_workflow(payload: ImageWorkflowRequest, _: None = Depends(require_access)):
    if len(payload.workflow) > 250:
        raise HTTPException(status_code=413, detail="سير العمل يحتوي على عدد عقد يتجاوز الحد المسموح.")
    for node_id, node in payload.workflow.items():
        if not isinstance(node_id, str) or not node_id.isdigit() or not isinstance(node, dict) or not node.get("class_type"):
            raise HTTPException(status_code=422, detail="صيغة سير عمل ComfyUI غير صالحة.")
    body = {"prompt": payload.workflow}
    if payload.client_id:
        body["client_id"] = payload.client_id
    try:
        async with httpx.AsyncClient(timeout=MEDIA_TIMEOUT) as client:
            response = await client.post(COMFYUI_BASE_URL + "/prompt", json=body)
            response.raise_for_status()
            result = response.json()
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=503, detail="ComfyUI غير متصل. شغّل المحرك المحلي أولاً.") from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="انتهت مهلة إرسال مهمة التوليد إلى ComfyUI.") from exc
    except httpx.HTTPStatusError as exc:
        try:
            detail = exc.response.json()
        except Exception:
            detail = "رفض ComfyUI سير العمل المرسل."
        raise HTTPException(status_code=502, detail=str(detail)[:1000]) from exc
    if not result.get("prompt_id"):
        raise HTTPException(status_code=502, detail="لم يُرجع ComfyUI معرّف مهمة صالحاً.")
    audit("media.image.queued", f"تم إرسال سير عمل إلى ComfyUI: {result['prompt_id']}")
    return {"provider": "comfyui", "prompt_id": result["prompt_id"], "number": result.get("number"), "status": "queued"}


@app.get("/api/media/image/history/{prompt_id}")
async def image_workflow_history(prompt_id: str, _: None = Depends(require_access)):
    if not re.fullmatch(r"[A-Za-z0-9-]{8,80}", prompt_id):
        raise HTTPException(status_code=400, detail="معرّف المهمة غير صالح.")
    return await media_get(COMFYUI_BASE_URL, "/history/" + prompt_id)



@app.get("/api/media/image/view")
async def view_generated_image(
    filename: str = Query(min_length=1, max_length=180),
    subfolder: str = Query(default="", max_length=240),
    image_type: str = Query(default="output", alias="type"),
    _: None = Depends(require_access),
):
    if Path(filename).name != filename or "\\" in filename or filename.startswith(".") or Path(filename).suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        raise HTTPException(status_code=400, detail="اسم ملف الصورة أو امتداده غير صالح.")
    if image_type != "output":
        raise HTTPException(status_code=400, detail="يُسمح بعرض صور المخرجات فقط.")
    if subfolder and (subfolder.startswith(("/", "\\")) or "\\" in subfolder or any(part in {"", ".", ".."} for part in subfolder.split("/")) or any(not re.fullmatch(r"[A-Za-z0-9 _.-]{1,80}", part) for part in subfolder.split("/"))):
        raise HTTPException(status_code=400, detail="مسار الصورة الفرعي غير صالح.")
    try:
        async with httpx.AsyncClient(timeout=MEDIA_TIMEOUT) as client:
            response = await client.get(
                COMFYUI_BASE_URL + "/view",
                params={"filename": filename, "subfolder": subfolder, "type": "output"},
            )
            response.raise_for_status()
            content = response.content
            content_type = response.headers.get("content-type", "application/octet-stream").split(";")[0].lower()
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=503, detail="ComfyUI غير متصل.") from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="انتهت مهلة تحميل الصورة.") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=404 if exc.response.status_code == 404 else 502, detail="تعذر جلب الصورة من ComfyUI.") from exc
    if content_type not in {"image/png", "image/jpeg", "image/webp", "image/gif"}:
        raise HTTPException(status_code=415, detail="أعاد محرك الصور نوع محتوى غير مدعوم.")
    return Response(content=content, media_type=content_type, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@app.get("/api/media/speech/status")
async def speech_engine_status(_: None = Depends(require_access)):
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(WHISPER_CPP_BASE_URL + "/health")
            response.raise_for_status()
        return {"provider": "whisper.cpp", "connected": True}
    except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError):
        return {"provider": "whisper.cpp", "connected": False, "message": "خدمة whisper.cpp المحلية غير متاحة حالياً."}


@app.post("/api/media/transcribe")
async def transcribe_audio(file: UploadFile = File(...), _: None = Depends(require_access)):
    filename = safe_filename(file.filename)
    if Path(filename).suffix.lower() not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(status_code=415, detail="صيغة الملف غير مدعومة. استخدم WAV أو فعّل --convert في whisper-server مع تثبيت FFmpeg للصيغ الأخرى.")
    content = await file.read(MAX_AUDIO_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="الملف الصوتي فارغ.")
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="الحد الأقصى للملف الصوتي 25 ميغابايت.")
    try:
        async with httpx.AsyncClient(timeout=MEDIA_TIMEOUT) as client:
            response = await client.post(
                WHISPER_CPP_BASE_URL + "/inference",
                files={"file": (filename, content, file.content_type or "application/octet-stream")},
                data={"response_format": "json"},
            )
            response.raise_for_status()
            result = response.json()
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=503, detail="whisper.cpp غير متصل. شغّل خادم التفريغ الصوتي المحلي أولاً.") from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="انتهت مهلة تفريغ الملف الصوتي.") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"فشل التفريغ الصوتي ({exc.response.status_code}).") from exc
    except (ValueError, httpx.DecodingError) as exc:
        raise HTTPException(status_code=502, detail="أعاد محرك التفريغ استجابة غير صالحة.") from exc
    transcript = result.get("text") or result.get("transcription")
    if not transcript:
        raise HTTPException(status_code=502, detail="لم يُرجع محرك التفريغ نصاً.")
    audit("media.audio.transcribed", f"تم تفريغ ملف صوتي محلي: {filename} ({len(content)} bytes)")
    return {"provider": "whisper.cpp", "text": transcript, "language": result.get("language")}


@app.get("/api/projects")
def list_projects(status: Literal["active", "archived"] | None = None, _: None = Depends(require_access)):
    with database() as db:
        if status:
            rows = db.execute("SELECT * FROM projects WHERE status=? ORDER BY updated_at DESC LIMIT 200", (status,)).fetchall()
        else:
            rows = db.execute("SELECT * FROM projects ORDER BY updated_at DESC LIMIT 200").fetchall()
    return {"items": [row_dict(row) for row in rows]}


@app.post("/api/projects", status_code=201)
def create_project(payload: ProjectCreate, _: None = Depends(require_access)):
    timestamp = now()
    with database() as db:
        cursor = db.execute(
            "INSERT INTO projects(title, description, status, created_at, updated_at) VALUES(?,?, 'active', ?, ?)",
            (payload.title.strip(), payload.description.strip(), timestamp, timestamp),
        )
        project_id = cursor.lastrowid
    workspace = DATA_DIR / "workspaces" / str(project_id)
    workspace.mkdir(parents=True, exist_ok=True)
    audit("project.created", f"تم إنشاء مساحة المشروع #${project_id}: {payload.title.strip()}")
    return {"id": project_id, "title": payload.title.strip(), "status": "active", "workspace_ready": True}


@app.post("/api/projects/{project_id}/archive")
def archive_project(project_id: int, _: None = Depends(require_access)):
    with database() as db:
        row = db.execute("SELECT id, status FROM projects WHERE id=?", (project_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="المشروع غير موجود.")
        if row["status"] == "archived":
            raise HTTPException(status_code=409, detail="المشروع مؤرشف مسبقاً.")
        db.execute("UPDATE projects SET status='archived', updated_at=? WHERE id=?", (now(), project_id))
    audit("project.archived", f"تمت أرشفة المشروع #${project_id}")
    return {"id": project_id, "status": "archived"}


MAX_UPLOAD_BYTES = 10 * 1024 * 1024
BLOCKED_EXTENSIONS = {".exe", ".dll", ".so", ".sh", ".bat", ".cmd", ".ps1", ".apk", ".msi", ".com"}


def project_workspace(project_id: int, require_active: bool = False) -> Path:
    with database() as db:
        project = db.execute("SELECT id, status FROM projects WHERE id=?", (project_id,)).fetchone()
    if project is None:
        raise HTTPException(status_code=404, detail="المشروع غير موجود.")
    if require_active and project["status"] != "active":
        raise HTTPException(status_code=409, detail="لا يمكن رفع ملفات إلى مشروع مؤرشف.")
    root = (DATA_DIR / "workspaces" / str(project_id)).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_filename(filename: str | None) -> str:
    raw = filename or ""
    if "/" in raw or "\\" in raw:
        raise HTTPException(status_code=400, detail="يجب رفع اسم ملف فقط دون مسارات.")
    name = Path(raw).name.strip()
    if not name or name in {".", ".."} or name.startswith("."):
        raise HTTPException(status_code=400, detail="اسم الملف غير صالح.")
    if Path(name).suffix.lower() in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="نوع الملف التنفيذي هذا غير مسموح برفعه.")
    return name


@app.get("/api/projects/{project_id}/files")
def list_project_files(project_id: int, _: None = Depends(require_access)):
    root = project_workspace(project_id)
    items = []
    for entry in sorted(root.iterdir(), key=lambda item: item.name.lower()):
        if entry.is_file() and not entry.is_symlink():
            stat = entry.stat()
            items.append({"name": entry.name, "size": stat.st_size, "modified_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()})
    return {"items": items[:200], "max_upload_bytes": MAX_UPLOAD_BYTES}


@app.post("/api/projects/{project_id}/files", status_code=201)
async def upload_project_file(project_id: int, file: UploadFile = File(...), _: None = Depends(require_access)):
    root = project_workspace(project_id, require_active=True)
    filename = safe_filename(file.filename)
    target = (root / filename).resolve()
    if target.parent != root or target.exists():
        raise HTTPException(status_code=409, detail="الملف موجود مسبقاً أو أن مساره غير مسموح.")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="الحد الأقصى لحجم الملف 10 ميغابايت.")
    if not content:
        raise HTTPException(status_code=400, detail="لا يمكن رفع ملف فارغ.")
    try:
        with target.open("xb") as output:
            output.write(content)
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail="الملف موجود مسبقاً.") from exc
    audit("project.file.uploaded", f"رفع ملف {filename} إلى المشروع #{project_id} ({len(content)} bytes)")
    return {"name": filename, "size": len(content), "uploaded": True}


@app.get("/api/projects/{project_id}/files/{filename}")
def download_project_file(project_id: int, filename: str, _: None = Depends(require_access)):
    root = project_workspace(project_id)
    safe = safe_filename(filename)
    target = (root / safe).resolve()
    if target.parent != root or not target.is_file() or target.is_symlink():
        raise HTTPException(status_code=404, detail="الملف غير موجود.")
    return FileResponse(target, filename=safe)


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
