from __future__ import annotations

import asyncio
import ipaddress
import json
import os
import re
import stat
import zipfile
import io
import secrets
import shutil
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
VERSION = "0.17.0"
API_TOKEN = os.getenv("SOULARAB_API_TOKEN", "").strip()
APP_ENV = os.getenv("SOULARAB_ENV", "local").lower()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "90"))
ROOH_PROVIDER = os.getenv("ROOH_PROVIDER", "ollama").strip().lower()
LLAMA_CPP_BASE_URL = os.getenv("LLAMA_CPP_BASE_URL", "http://127.0.0.1:8081").rstrip("/")
ALLOW_DOCKER_OLLAMA = os.getenv("SOULARAB_ALLOW_DOCKER_OLLAMA", "").lower() == "true"
ALLOW_DOCKER_MEDIA = os.getenv("SOULARAB_ALLOW_DOCKER_MEDIA", "").lower() == "true"
COMFYUI_BASE_URL = os.getenv("COMFYUI_BASE_URL", "http://127.0.0.1:8188").rstrip("/")
WHISPER_CPP_BASE_URL = os.getenv("WHISPER_CPP_BASE_URL", "http://127.0.0.1:8080").rstrip("/")
MEDIA_TIMEOUT = float(os.getenv("SOULARAB_MEDIA_TIMEOUT_SECONDS", "180"))
MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_IMAGE_BYTES = 20 * 1024 * 1024
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac", ".mp4", ".mpeg", ".mpga"}
ALLOWED_ORIGINS = [v.strip() for v in os.getenv("SOULARAB_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,https://localhost,capacitor://localhost").split(",") if v.strip()]


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
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            department TEXT NOT NULL CHECK(department IN ('work','hub','jathr','files','system')),
            status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','planning','waiting_approval','running','completed','failed','cancelled')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)
        approval_columns = {row["name"] for row in db.execute("PRAGMA table_info(approvals)").fetchall()}
        if "task_id" not in approval_columns:
            db.execute("ALTER TABLE approvals ADD COLUMN task_id INTEGER REFERENCES tasks(id)")
        db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_approvals_task_id ON approvals(task_id) WHERE task_id IS NOT NULL")
        db.execute("""
            CREATE TABLE IF NOT EXISTS task_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                from_status TEXT,
                to_status TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id, id DESC)")
        db.execute("""
            CREATE TABLE IF NOT EXISTS vault_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                source TEXT NOT NULL CHECK(source IN ('owner','rooh')),
                created_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS mesh_nodes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('A','B','C','D','E')),
                base_url TEXT NOT NULL UNIQUE,
                capabilities TEXT NOT NULL DEFAULT '[]',
                last_seen TEXT,
                created_at TEXT NOT NULL
            )
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
    allow_methods=["GET", "POST", "DELETE"],
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


class TaskCreate(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(default="", max_length=4000)
    department: Literal["work", "hub", "jathr", "files", "system"]

class VaultNoteCreate(BaseModel):
    content: str = Field(min_length=1, max_length=12000)
    source: Literal["owner", "rooh"] = "owner"
    owner_approved: bool = False


class AgentPlanCreate(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=5, max_length=4000)
    risk: Literal["low", "medium", "high"] = "medium"
    department: Literal["work", "hub", "jathr", "files", "system"] = "system"


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

if ROOH_PROVIDER not in {"ollama", "llama_cpp"}:
    raise RuntimeError("ROOH_PROVIDER must be either ollama or llama_cpp.")
try:
    LLAMA_CPP_BASE_URL = validate_local_provider_url(LLAMA_CPP_BASE_URL)
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

async def llama_cpp_request(method: str, path: str, payload: dict | None = None):
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            response = await client.request(method, LLAMA_CPP_BASE_URL + path, json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=503, detail="محرك روح المحلي (llama.cpp) غير متصل. شغّل نموذج روح على جهاز الخادم.") from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="انتهت مهلة انتظار نموذج روح المحلي.") from exc
    except httpx.HTTPStatusError as exc:
        detail = "تعذر على محرك روح المحلي إكمال الطلب."
        try:
            detail = exc.response.json().get("error", {}).get("message", detail)
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=str(detail)[:500]) from exc
    except (ValueError, httpx.DecodingError) as exc:
        raise HTTPException(status_code=502, detail="أعاد محرك روح المحلي استجابة غير صالحة.") from exc


def rooh_system_message() -> dict:
    return {
        "role": "system",
        "content": "أنت روح AI، المساعدة الذكية الرسمية لمنصة SOULARAB TECH. تحدث بالعربية افتراضياً وبأسلوب واضح وودود. افهم طلب المستخدم، لخّص المطلوب، واقترح خطوات عملية. لا تدّعي تنفيذ إجراء أو الوصول إلى ملف أو جهاز أو خدمة ما لم تؤكد الأداة نجاحه. لا تنفذ أوامر أو تغييرات أو إرسالاً خارجياً دون موافقة صريحة ومحددة من المستخدم. لا تطلب بيانات سرية ولا تحاول الوصول إلى الخزنة."
    }


def row_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def record_task_event(db: sqlite3.Connection, task_id: int, event_type: str, from_status: str | None, to_status: str, details: str, timestamp: str) -> None:
    db.execute(
        "INSERT INTO task_events(task_id,event_type,from_status,to_status,details,created_at) VALUES(?,?,?,?,?,?)",
        (task_id, event_type, from_status, to_status, details[:2000], timestamp),
    )



class MeshNodeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    role: Literal["A", "B", "C", "D", "E"]
    base_url: str = Field(min_length=8, max_length=240)

    @field_validator("base_url")
    @classmethod
    def validate_private_node_url(cls, value: str) -> str:
        parsed = urlparse(value.strip().rstrip("/"))
        if parsed.scheme != "http" or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
            raise ValueError("العقد مسموحة عبر HTTP محلي فقط، دون مسارات أو بيانات دخول.")
        host = parsed.hostname.lower()
        if host == "localhost":
            return parsed.origin if hasattr(parsed, "origin") else f"http://{host}:{parsed.port}" if parsed.port else f"http://{host}"
        try:
            address = ipaddress.ip_address(host)
        except ValueError as exc:
            raise ValueError("استخدم عنوان IP محلياً موثوقاً؛ أسماء النطاقات العامة غير مسموحة.") from exc
        if not (address.is_loopback or address.is_private) or address.is_multicast or address.is_unspecified or address.is_reserved:
            raise ValueError("يُسمح بعناوين loopback أو الشبكة الخاصة فقط.")
        host_part = f"[{address.compressed}]" if address.version == 6 else address.compressed
        return f"http://{host_part}" + (f":{parsed.port}" if parsed.port else "")


MESH_ROLES = {
    "A": {"name": "النصوص والمحادثة", "capabilities": ["text", "chat"]},
    "B": {"name": "الصور والتصميم", "capabilities": ["image", "design"]},
    "C": {"name": "الصوت والفيديو", "capabilities": ["audio", "video", "transcription"]},
    "D": {"name": "البرمجة والتطبيقات", "capabilities": ["code", "app_build"]},
    "E": {"name": "الاحتياطي وتوزيع المهام", "capabilities": ["fallback", "task_routing"]},
}


@app.get("/api/mesh/manifest")
def mesh_manifest():
    return {
        "product": "SOULARAB TECH",
        "mesh_protocol": 1,
        "version": VERSION,
        "node_type": "soularab-worker",
        "capabilities": ["api", "projects", "tasks", "local_storage"],
        "external_services_required": False,
    }


@app.post("/api/mesh/discover")
async def mesh_discover(payload: MeshNodeCreate, _: None = Depends(require_access)):
    base = payload.base_url
    try:
        async with httpx.AsyncClient(timeout=3.5, follow_redirects=False) as client:
            health_response = await client.get(base + "/api/health")
            health_response.raise_for_status()
            health_data = health_response.json()
            manifest_response = await client.get(base + "/api/mesh/manifest")
            manifest_response.raise_for_status()
            manifest = manifest_response.json()
        if health_data.get("status") != "ok" or manifest.get("product") != "SOULARAB TECH" or manifest.get("mesh_protocol") != 1:
            raise HTTPException(status_code=422, detail="العقدة لا تعلن توافق بروتوكول SOULARAB MESH.")
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="لم يستجب الخادم المحلي أو فشل فحص التوافق.") from exc
    node_id = secrets.token_urlsafe(12)
    timestamp = now()
    capabilities = sorted(set(manifest.get("capabilities", [])))
    with database() as db:
        existing = db.execute("SELECT id FROM mesh_nodes WHERE base_url=?", (base,)).fetchone()
        if existing:
            node_id = existing["id"]
            db.execute(
                "UPDATE mesh_nodes SET name=?, role=?, capabilities=?, last_seen=? WHERE id=?",
                (payload.name.strip(), payload.role, json.dumps(capabilities), timestamp, node_id),
            )
        else:
            db.execute(
                "INSERT INTO mesh_nodes(id,name,role,base_url,capabilities,last_seen,created_at) VALUES(?,?,?,?,?,?,?)",
                (node_id, payload.name.strip(), payload.role, base, json.dumps(capabilities), timestamp, timestamp),
            )
    audit("mesh.node_discovered", f"{payload.role}:{payload.name.strip()} at {base}")
    return {"id": node_id, "name": payload.name.strip(), "role": payload.role, "base_url": base, "status": "online", "capabilities": capabilities, "version": manifest.get("version")}


@app.get("/api/mesh/status")
async def mesh_status(_: None = Depends(require_access)):
    with database() as db:
        rows = [dict(row) for row in db.execute("SELECT * FROM mesh_nodes ORDER BY role, created_at").fetchall()]
    async def probe(node):
        status = "offline"
        version = None
        latency_ms = None
        started = asyncio.get_running_loop().time()
        try:
            async with httpx.AsyncClient(timeout=2.5, follow_redirects=False) as client:
                response = await client.get(node["base_url"] + "/api/health")
                response.raise_for_status()
                data = response.json()
                if data.get("status") == "ok":
                    status = "online"
                    version = data.get("version")
                    latency_ms = round((asyncio.get_running_loop().time() - started) * 1000)
                    with database() as db:
                        db.execute("UPDATE mesh_nodes SET last_seen=? WHERE id=?", (now(), node["id"]))
        except (httpx.HTTPError, ValueError):
            pass
        try:
            capabilities = json.loads(node["capabilities"])
        except (TypeError, json.JSONDecodeError):
            capabilities = []
        return {"id": node["id"], "name": node["name"], "role": node["role"], "role_name": MESH_ROLES[node["role"]]["name"], "base_url": node["base_url"], "status": status, "latency_ms": latency_ms, "version": version, "capabilities": capabilities, "last_seen": node["last_seen"]}
    checked = await asyncio.gather(*(probe(node) for node in rows))
    slots = []
    for role, details in MESH_ROLES.items():
        role_nodes = [node for node in checked if node["role"] == role]
        online = sorted((node for node in role_nodes if node["status"] == "online"), key=lambda item: item["latency_ms"] or 999999)
        slots.append({"role": role, **details, "status": "online" if online else "offline", "selected_node": online[0] if online else None, "nodes": role_nodes})
    return {"protocol": 1, "policy": "trusted_private_nodes_only", "external_discovery": False, "slots": slots, "online_nodes": sum(1 for node in checked if node["status"] == "online"), "registered_nodes": len(checked)}


@app.delete("/api/mesh/nodes/{node_id}")
def mesh_remove_node(node_id: str, _: None = Depends(require_access)):
    with database() as db:
        cursor = db.execute("DELETE FROM mesh_nodes WHERE id=?", (node_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="العقدة غير موجودة.")
    audit("mesh.node_removed", node_id)
    return {"removed": True, "id": node_id}


@app.get("/api/health")
def health():
    return {"status": "ok", "version": VERSION, "mode": APP_ENV, "external_connections": "disabled_by_default"}


@app.get("/api/security/status")
def security_status(_: None = Depends(require_access)):
    return {
        "environment": APP_ENV,
        "token_configured": bool(API_TOKEN),
        "access_mode": "bearer_token" if API_TOKEN else ("blocked_until_token" if APP_ENV == "production" else "local_without_token"),
        "identity_model": "single_shared_api_token",
        "account_management": False,
        "browser_session_control": "optional_client_side_inactivity_lock",
        "external_connections_default": "disabled_by_default",
        "cors_origins": ALLOWED_ORIGINS,
    }


@app.get("/api/assistant/status")
async def assistant_status(_: None = Depends(require_access)):
    try:
        if ROOH_PROVIDER == "llama_cpp":
            data = await llama_cpp_request("GET", "/health")
            return {"provider": "llama_cpp", "connected": data.get("status") in {"ok", "no slot available"}, "version": data.get("status")}
        data = await ollama_request("/api/version")
        return {"provider": "ollama", "connected": True, "version": data.get("version")}
    except HTTPException as exc:
        if exc.status_code == 503:
            return {"provider": ROOH_PROVIDER, "connected": False, "message": exc.detail}
        raise

@app.get("/api/assistant/models")
async def assistant_models(_: None = Depends(require_access)):
    if ROOH_PROVIDER == "llama_cpp":
        data = await llama_cpp_request("GET", "/v1/models")
        models = [{"name": item.get("id"), "size": None, "modified_at": None} for item in data.get("data", []) if item.get("id")]
        return {"provider": "llama_cpp", "items": models}
    data = await ollama_request("/api/tags")
    models = [{"name": item.get("name"), "size": item.get("size"), "modified_at": item.get("modified_at")} for item in data.get("models", []) if item.get("name")]
    return {"provider": "ollama", "items": models}

@app.post("/api/assistant/chat")
async def assistant_chat(payload: ChatRequest, _: None = Depends(require_access)):
    messages = [rooh_system_message(), *[message.model_dump() for message in payload.messages]]
    if ROOH_PROVIDER == "llama_cpp":
        response = await llama_cpp_request("POST", "/v1/chat/completions", {
            "model": payload.model,
            "messages": messages,
            "temperature": payload.temperature,
            "stream": False,
        })
        choices = response.get("choices", [])
        message = choices[0].get("message", {}) if choices else {}
        content = message.get("content", "")
    else:
        models = await ollama_request("/api/tags")
        available = {item.get("name") for item in models.get("models", [])}
        if payload.model not in available:
            raise HTTPException(status_code=404, detail="النموذج المحدد غير موجود في Ollama المحلية.")
        response = await ollama_request("/api/chat", {"model": payload.model, "messages": messages, "stream": False, "options": {"temperature": payload.temperature}})
        message = response.get("message", {})
        content = message.get("content", "")
    if not content:
        raise HTTPException(status_code=502, detail="لم يُرجع نموذج روح محتوى.")
    audit("assistant.chat", "محرك محلي: " + ROOH_PROVIDER + "؛ نموذج: " + payload.model + "؛ عدد الرسائل: " + str(len(payload.messages)))
    return {"provider": ROOH_PROVIDER, "model": payload.model, "message": {"role": "assistant", "content": content}, "done": True}

@app.get("/api/capabilities")
def capabilities():
    return {
        "modules": ["assistant", "web", "design", "media", "apps", "files", "agents", "domains", "security"],
        "providers": {"rooh": ROOH_PROVIDER, "ollama": "available_when_selected", "llama_cpp": "available_when_selected", "comfyui": "local_loopback_opt_in", "whisper_cpp": "local_loopback_opt_in"},
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


COMFYUI_ALLOWED_NODE_TYPES = {
    "1": "CheckpointLoaderSimple",
    "2": "CLIPTextEncode",
    "3": "CLIPTextEncode",
    "4": "EmptyLatentImage",
    "5": "KSampler",
    "6": "VAEDecode",
    "7": "SaveImage",
}
COMFYUI_ALLOWED_SAMPLERS = {
    "euler", "euler_ancestral", "heun", "dpm_2", "dpm_2_ancestral",
    "lms", "dpm_fast", "dpm_adaptive", "dpmpp_2s_ancestral",
    "dpmpp_sde", "dpmpp_2m", "dpmpp_2m_sde", "ddim",
    "uni_pc", "uni_pc_bh2",
}
COMFYUI_ALLOWED_SCHEDULERS = {"normal", "karras", "exponential", "simple", "sgm_uniform"}


def validate_comfy_workflow(workflow: dict) -> None:
    """Accept only the fixed, bounded image-generation graph used by the UI."""
    if not isinstance(workflow, dict) or set(workflow) != set(COMFYUI_ALLOWED_NODE_TYPES):
        raise ValueError("يسمح فقط بمخطط توليد الصور القياسي المكوّن من سبع عقد.")
    for node_id, expected_type in COMFYUI_ALLOWED_NODE_TYPES.items():
        node = workflow.get(node_id)
        if not isinstance(node, dict) or node.get("class_type") != expected_type or not isinstance(node.get("inputs"), dict):
            raise ValueError("نوع عقدة ComfyUI أو بنيتها غير مسموح.")
    expected_inputs = {
        "1": {"ckpt_name"},
        "2": {"text", "clip"},
        "3": {"text", "clip"},
        "4": {"width", "height", "batch_size"},
        "5": {"seed", "steps", "cfg", "sampler_name", "scheduler", "denoise", "model", "positive", "negative", "latent_image"},
        "6": {"samples", "vae"},
        "7": {"images", "filename_prefix"},
    }
    for node_id, keys in expected_inputs.items():
        if set(workflow[node_id]["inputs"]) != keys:
            raise ValueError("مدخلات إحدى عقد ComfyUI غير مطابقة للمخطط الآمن.")
    checkpoint = workflow["1"]["inputs"]["ckpt_name"]
    if not isinstance(checkpoint, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._ -]{0,119}", checkpoint) or ".." in checkpoint:
        raise ValueError("اسم نموذج الصورة غير صالح.")
    for node_id in ("2", "3"):
        inputs = workflow[node_id]["inputs"]
        if not isinstance(inputs["text"], str) or len(inputs["text"]) > 4000 or inputs["clip"] != ["1", 1]:
            raise ValueError("نص المطالبة أو مرجع CLIP غير صالح.")
    latent = workflow["4"]["inputs"]
    for dimension in ("width", "height"):
        value = latent[dimension]
        if isinstance(value, bool) or not isinstance(value, int) or value < 256 or value > 1536 or value % 64:
            raise ValueError("أبعاد الصورة يجب أن تكون بين 256 و1536 وبمضاعفات 64.")
    if latent["batch_size"] != 1:
        raise ValueError("يسمح بتوليد صورة واحدة في كل مهمة.")
    sampler = workflow["5"]["inputs"]
    integer_ranges = {"seed": (0, 4_294_967_295), "steps": (1, 60)}
    for key, (minimum, maximum) in integer_ranges.items():
        value = sampler[key]
        if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
            raise ValueError("قيمة إعدادات KSampler خارج الحدود المسموحة.")
    if isinstance(sampler["cfg"], bool) or not isinstance(sampler["cfg"], (int, float)) or not 1 <= sampler["cfg"] <= 20:
        raise ValueError("قيمة CFG خارج الحدود المسموحة.")
    if isinstance(sampler["denoise"], bool) or not isinstance(sampler["denoise"], (int, float)) or not 0 < sampler["denoise"] <= 1:
        raise ValueError("قيمة denoise خارج الحدود المسموحة.")
    if sampler["sampler_name"] not in COMFYUI_ALLOWED_SAMPLERS or sampler["scheduler"] not in COMFYUI_ALLOWED_SCHEDULERS:
        raise ValueError("خوارزمية أخذ العينات أو الجدولة غير مسموحة.")
    references = {
        "model": ["1", 0], "positive": ["2", 0],
        "negative": ["3", 0], "latent_image": ["4", 0],
    }
    if any(sampler[key] != value for key, value in references.items()):
        raise ValueError("مراجع KSampler لا تطابق مخطط التوليد الآمن.")
    if workflow["6"]["inputs"] != {"samples": ["5", 0], "vae": ["1", 2]}:
        raise ValueError("مراجع VAEDecode غير صالحة.")
    save = workflow["7"]["inputs"]
    if save["images"] != ["6", 0] or not isinstance(save["filename_prefix"], str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", save["filename_prefix"]):
        raise ValueError("إعداد حفظ الصورة غير صالح.")


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


@app.get("/api/engines/status")
async def local_engines_status(_: None = Depends(require_access)):
    probes = (
        ("ollama", OLLAMA_BASE_URL, "/api/version"),
        ("comfyui", COMFYUI_BASE_URL, "/system_stats"),
        ("whisper_cpp", WHISPER_CPP_BASE_URL, "/health"),
    )

    async def probe(provider: str, base_url: str, path: str) -> tuple[str, dict]:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(base_url + path)
                response.raise_for_status()
            return provider, {"connected": True}
        except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError, httpx.RequestError):
            return provider, {"connected": False}

    results = await asyncio.gather(*(probe(provider, base_url, path) for provider, base_url, path in probes))
    return {"providers": dict(results), "checked_at": now(), "network_scope": "local_only"}


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
    try:
        validate_comfy_workflow(payload.workflow)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
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
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="حجم الصورة الناتجة يتجاوز 20 ميغابايت.")
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


MAX_PROJECT_ARCHIVE_BYTES = 50 * 1024 * 1024
MAX_PROJECT_ARCHIVE_FILES = 200


@app.get("/api/projects/{project_id}/export")
def export_project_archive(project_id: int, _: None = Depends(require_access)):
    workspace_base = (DATA_DIR / "workspaces").resolve()
    workspace_path = workspace_base / str(project_id)
    if workspace_path.is_symlink():
        raise HTTPException(status_code=409, detail="مساحة المشروع تشير إلى مسار غير آمن.")
    root = project_workspace(project_id)
    if root.parent != workspace_base:
        raise HTTPException(status_code=409, detail="مساحة المشروع خارج مجلد التخزين المسموح.")

    with database() as db:
        project = db.execute("SELECT id, title, description, status, created_at, updated_at FROM projects WHERE id=?", (project_id,)).fetchone()
    if project is None:
        raise HTTPException(status_code=404, detail="المشروع غير موجود.")

    entries = []
    for entry in sorted(root.iterdir(), key=lambda item: item.name.lower()):
        try:
            info = entry.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(info.st_mode):
            continue
        if stat.S_ISREG(info.st_mode):
            entries.append((entry, info.st_size))
    if len(entries) > MAX_PROJECT_ARCHIVE_FILES:
        raise HTTPException(status_code=413, detail="عدد ملفات المشروع يتجاوز حد التصدير (200 ملف).")

    buffer = io.BytesIO()
    total_bytes = 0
    try:
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("project.json", json.dumps(dict(project), ensure_ascii=False, indent=2))
            for entry, _ in entries:
                flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
                descriptor = os.open(entry, flags)
                with os.fdopen(descriptor, "rb") as source:
                    info = os.fstat(source.fileno())
                    if not stat.S_ISREG(info.st_mode):
                        continue
                    remaining = MAX_PROJECT_ARCHIVE_BYTES - total_bytes
                    content = source.read(remaining + 1)
                    if len(content) > remaining:
                        raise HTTPException(status_code=413, detail="حجم ملفات المشروع يتجاوز حد التصدير (50 MB).")
                    total_bytes += len(content)
                    archive.writestr(entry.name, content)
    except OSError as exc:
        raise HTTPException(status_code=409, detail="تغيرت ملفات المشروع أثناء التصدير؛ أعد المحاولة.") from exc

    audit("project.exported", f"تم تصدير المشروع #{project_id} كأرشيف ZIP ({len(entries)} ملف).")
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="soularab-project-{project_id}.zip"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


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
    audit("project.created", f"تم إنشاء مساحة المشروع #{project_id}: {payload.title.strip()}")
    return {"id": project_id, "title": payload.title.strip(), "status": "active", "workspace_ready": True}


MAX_PROJECT_ARCHIVE_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_PROJECT_ARCHIVE_UNPACKED_BYTES = 50 * 1024 * 1024


@app.post("/api/projects/import", status_code=201)
async def import_project_archive(file: UploadFile = File(...), _: None = Depends(require_access)):
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(status_code=415, detail="يجب اختيار ملف ZIP صالح.")
    raw = await file.read(MAX_PROJECT_ARCHIVE_UPLOAD_BYTES + 1)
    if len(raw) > MAX_PROJECT_ARCHIVE_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="حجم ملف الأرشيف يتجاوز 50 MB.")
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="ملف ZIP تالف أو غير صالح.") from exc

    with archive:
        infos = archive.infolist()
        if len(infos) > MAX_PROJECT_ARCHIVE_FILES + 1:
            raise HTTPException(status_code=413, detail="الأرشيف يحتوي على أكثر من 200 ملف.")
        names = [item.filename for item in infos]
        if len(names) != len(set(names)) or "project.json" not in names:
            raise HTTPException(status_code=400, detail="الأرشيف يفتقد بيانات المشروع أو يحتوي على أسماء مكررة.")

        metadata_info = next(item for item in infos if item.filename == "project.json")
        metadata_mode = metadata_info.external_attr >> 16
        metadata_type = stat.S_IFMT(metadata_mode)
        if metadata_info.is_dir() or stat.S_ISLNK(metadata_mode) or metadata_type not in {0, stat.S_IFREG}:
            raise HTTPException(status_code=400, detail="بيانات المشروع داخل الأرشيف ليست ملفاً عادياً.")
        if metadata_info.file_size > 64 * 1024 or metadata_info.flag_bits & 0x1:
            raise HTTPException(status_code=400, detail="بيانات المشروع داخل الأرشيف غير صالحة.")
        try:
            metadata = json.loads(archive.read(metadata_info).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError, OSError) as exc:
            raise HTTPException(status_code=400, detail="تعذر قراءة بيانات المشروع داخل الأرشيف.") from exc
        if not isinstance(metadata, dict):
            raise HTTPException(status_code=400, detail="بيانات المشروع داخل الأرشيف غير صالحة.")
        title = str(metadata.get("title") or "Imported project").strip()[:88]
        if len(title) < 2:
            title = "Imported project"
        title = title + " (restored)"

        files_to_restore = []
        unpacked_total = 0
        for info in infos:
            if info.filename == "project.json":
                continue
            mode = info.external_attr >> 16
            file_type = stat.S_IFMT(mode)
            if info.is_dir() or stat.S_ISLNK(mode) or file_type not in {0, stat.S_IFREG} or info.flag_bits & 0x1:
                raise HTTPException(status_code=400, detail="الأرشيف يحتوي على مجلدات أو روابط أو ملفات غير عادية أو مشفرة غير مسموح بها.")
            if "/" in info.filename or "\\" in info.filename:
                raise HTTPException(status_code=400, detail="مسارات الملفات داخل الأرشيف غير مسموح بها.")
            try:
                filename = safe_filename(info.filename)
            except HTTPException as exc:
                raise HTTPException(status_code=400, detail="الأرشيف يحتوي على اسم ملف غير مسموح.") from exc
            if filename != info.filename:
                raise HTTPException(status_code=400, detail="الأرشيف يحتوي على اسم ملف غير صالح.")
            unpacked_total += info.file_size
            if unpacked_total > MAX_PROJECT_ARCHIVE_UNPACKED_BYTES:
                raise HTTPException(status_code=413, detail="الحجم بعد فك الأرشيف يتجاوز 50 MB.")
            files_to_restore.append((info, filename))

        workspaces_dir = DATA_DIR / "workspaces"
        if workspaces_dir.is_symlink():
            raise HTTPException(status_code=409, detail="مجلد مساحات المشاريع يشير إلى مسار غير آمن.")
        workspaces_dir.mkdir(parents=True, exist_ok=True)
        workspace_base = workspaces_dir.resolve()
        if workspace_base.parent != DATA_DIR.resolve():
            raise HTTPException(status_code=409, detail="مجلد مساحات المشاريع خارج مسار التخزين المسموح.")

        timestamp = now()
        with database() as db:
            cursor = db.execute(
                "INSERT INTO projects(title, description, status, created_at, updated_at) VALUES(?,?, 'active', ?, ?)",
                (title, str(metadata.get("description") or "")[:1000], timestamp, timestamp),
            )
            project_id = cursor.lastrowid
        workspace = workspace_base / str(project_id)
        workspace_created = False
        try:
            workspace.mkdir(parents=False, exist_ok=False)
            workspace_created = True
            for info, filename in files_to_restore:
                content = archive.read(info)
                if len(content) != info.file_size:
                    raise ValueError("Archive entry size mismatch.")
                with (workspace / filename).open("xb") as output:
                    output.write(content)
        except Exception as exc:
            if workspace_created:
                shutil.rmtree(workspace, ignore_errors=True)
            with database() as db:
                db.execute("DELETE FROM projects WHERE id=?", (project_id,))
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(status_code=400, detail="تعذر استعادة ملفات المشروع؛ لم يتم الاحتفاظ بمشروع جزئي.") from exc

    audit("project.imported", f"تم استيراد أرشيف مشروع جديد #{project_id} مع {len(files_to_restore)} ملف.")
    return {"id": project_id, "title": title, "status": "active", "restored_files": len(files_to_restore)}


@app.post("/api/projects/{project_id}/archive")
def archive_project(project_id: int, _: None = Depends(require_access)):
    with database() as db:
        row = db.execute("SELECT id, status FROM projects WHERE id=?", (project_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="المشروع غير موجود.")
        if row["status"] == "archived":
            raise HTTPException(status_code=409, detail="المشروع مؤرشف مسبقاً.")
        db.execute("UPDATE projects SET status='archived', updated_at=? WHERE id=?", (now(), project_id))
    audit("project.archived", f"تمت أرشفة المشروع #{project_id}")
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


@app.delete("/api/projects/{project_id}/files/{filename}")
def delete_project_file(project_id: int, filename: str, _: None = Depends(require_access)):
    root = project_workspace(project_id, require_active=True)
    safe = safe_filename(filename)
    target = root / safe
    if target.parent.resolve() != root or target.is_symlink() or not target.is_file():
        raise HTTPException(status_code=404, detail="الملف غير موجود.")
    size = target.stat().st_size
    target.unlink()
    audit("project.file.deleted", f"حُذف الملف {safe} من المشروع #{project_id} ({size} bytes).")
    return {"project_id": project_id, "name": safe, "deleted": True}


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


@app.post("/api/agent-plans", status_code=201)
def create_agent_plan(payload: AgentPlanCreate, _: None = Depends(require_access)):
    title = payload.title.strip()
    description = payload.description.strip()
    if len(title) < 3 or len(description) < 5:
        raise HTTPException(status_code=422, detail="أدخل عنواناً ووصفاً صالحين للخطة.")
    timestamp = now()
    with database() as db:
        task_cursor = db.execute(
            "INSERT INTO tasks(title,description,department,status,created_at,updated_at) VALUES(?,?,?,'waiting_approval',?,?)",
            (title, description, payload.department, timestamp, timestamp),
        )
        task_id = task_cursor.lastrowid
        approval_cursor = db.execute(
            "INSERT INTO approvals(title,description,risk,status,created_at,task_id) VALUES(?,?,?,'pending',?,?)",
            (title, description, payload.risk, timestamp, task_id),
        )
        approval_id = approval_cursor.lastrowid
        record_task_event(db, task_id, "agent_plan.created", None, "waiting_approval", f"أُنشئت المهمة وربطت بطلب الموافقة #{approval_id}.", timestamp)
        db.execute("INSERT INTO audit(action,details,created_at) VALUES(?,?,?)", ("agent_plan.created", f"الخطة #{task_id} مرتبطة بطلب الموافقة #{approval_id}. لم يبدأ التنفيذ.", timestamp))
    return {"task_id": task_id, "task_status": "waiting_approval", "approval_id": approval_id, "approval_status": "pending", "execution": "not_started"}


@app.post("/api/approvals/{approval_id}/decision")
def decide_approval(approval_id: int, payload: ApprovalDecision, _: None = Depends(require_access)):
    task_status = None
    with database() as db:
        row = db.execute("SELECT * FROM approvals WHERE id=?", (approval_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="طلب الموافقة غير موجود.")
        if row["status"] != "pending":
            raise HTTPException(status_code=409, detail="تم اتخاذ قرار بشأن هذا الطلب مسبقاً.")
        timestamp = now()
        db.execute(
            "UPDATE approvals SET status=?, decided_at=?, decision_note=? WHERE id=?",
            (payload.decision, timestamp, payload.note, approval_id),
        )
        if row["task_id"] is not None:
            task = db.execute("SELECT status FROM tasks WHERE id=?", (row["task_id"],)).fetchone()
            if task is None or task["status"] != "waiting_approval":
                raise HTTPException(status_code=409, detail="حالة المهمة المرتبطة لا تسمح بتغيير قرار الموافقة.")
            task_status = "queued" if payload.decision == "approved" else "cancelled"
            db.execute("UPDATE tasks SET status=?, updated_at=? WHERE id=?", (task_status, timestamp, row["task_id"]))
            record_task_event(db, row["task_id"], f"approval.{payload.decision}", "waiting_approval", task_status, f"تم {('اعتماد' if payload.decision == 'approved' else 'رفض')} طلب الموافقة #{approval_id}. لم يبدأ التنفيذ.", timestamp)
        db.execute("INSERT INTO audit(action,details,created_at) VALUES(?,?,?)", (f"approval.{payload.decision}", f"طلب #{approval_id}. لم يتم تنفيذ الإجراء.", timestamp))
        if task_status:
            db.execute("INSERT INTO audit(action,details,created_at) VALUES(?,?,?)", ("task.approval_transition", f"المهمة #{row['task_id']} أصبحت {task_status} بعد قرار الموافقة؛ لم يبدأ التنفيذ.", timestamp))
    return {"id": approval_id, "status": payload.decision, "task_id": row["task_id"], "task_status": task_status, "execution": "not_started"}


@app.get("/api/tasks")
def list_tasks(status: Literal["queued", "planning", "waiting_approval", "running", "completed", "failed", "cancelled"] | None = None, _: None = Depends(require_access)):
    with database() as db:
        if status:
            rows = db.execute("SELECT * FROM tasks WHERE status=? ORDER BY id DESC LIMIT 200", (status,)).fetchall()
        else:
            rows = db.execute("SELECT * FROM tasks ORDER BY id DESC LIMIT 200").fetchall()
    return {"items": [row_dict(row) for row in rows]}


@app.get("/api/tasks/{task_id}/events")
def list_task_events(task_id: int, _: None = Depends(require_access)):
    with database() as db:
        exists = db.execute("SELECT id FROM tasks WHERE id=?", (task_id,)).fetchone()
        if exists is None:
            raise HTTPException(status_code=404, detail="المهمة غير موجودة.")
        rows = db.execute("SELECT * FROM task_events WHERE task_id=? ORDER BY id DESC LIMIT 100", (task_id,)).fetchall()
    return {"items": [row_dict(row) for row in rows]}


@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskCreate, _: None = Depends(require_access)):
    title = payload.title.strip()
    if len(title) < 3:
        raise HTTPException(status_code=422, detail="عنوان المهمة يجب أن يحتوي على ثلاثة أحرف على الأقل.")
    timestamp = now()
    with database() as db:
        cursor = db.execute(
            "INSERT INTO tasks(title,description,department,status,created_at,updated_at) VALUES(?,?,?,'queued',?,?)",
            (title, payload.description.strip(), payload.department, timestamp, timestamp),
        )
        task_id = cursor.lastrowid
        record_task_event(db, task_id, "task.created", None, "queued", "تم إنشاء المهمة؛ لم يبدأ التنفيذ.", timestamp)
    audit("task.queued", f"مهمة #{task_id}: {title}؛ لم يبدأ التنفيذ.")
    return {"id": task_id, "status": "queued", "execution": "not_started"}


@app.post("/api/tasks/{task_id}/cancel")
def cancel_task(task_id: int, _: None = Depends(require_access)):
    timestamp = now()
    linked_approval_id = None
    with database() as db:
        row = db.execute("SELECT status FROM tasks WHERE id=?", (task_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="المهمة غير موجودة.")
        if row["status"] == "running":
            raise HTTPException(status_code=409, detail="لا يمكن تأكيد إيقاف مهمة قيد التنفيذ؛ لا يدعم هذا الإصدار إيقاف عامل تنفيذ.")
        if row["status"] in {"completed", "failed", "cancelled"}:
            raise HTTPException(status_code=409, detail="لا يمكن إلغاء هذه المهمة في حالتها الحالية.")
        approval = db.execute("SELECT id FROM approvals WHERE task_id=? AND status='pending'", (task_id,)).fetchone()
        if approval:
            linked_approval_id = approval["id"]
            db.execute("UPDATE approvals SET status='rejected', decided_at=?, decision_note='ألغى المستخدم المهمة قبل الموافقة.' WHERE id=?", (timestamp, linked_approval_id))
        db.execute("UPDATE tasks SET status='cancelled', updated_at=? WHERE id=?", (timestamp, task_id))
        record_task_event(db, task_id, "task.cancelled", row["status"], "cancelled", "ألغى المستخدم المهمة قبل بدء التنفيذ.", timestamp)
        db.execute("INSERT INTO audit(action,details,created_at) VALUES(?,?,?)", ("task.cancelled", f"تم إلغاء المهمة #{task_id} قبل بدء التنفيذ.", timestamp))
        if linked_approval_id:
            db.execute("INSERT INTO audit(action,details,created_at) VALUES(?,?,?)", ("approval.rejected", f"أُغلق طلب الموافقة #{linked_approval_id} بسبب إلغاء المهمة #{task_id}.", timestamp))
    return {"id": task_id, "status": "cancelled", "approval_id": linked_approval_id, "execution": "not_started"}


@app.get("/api/vault/notes")
def list_vault_notes(_: None = Depends(require_access)):
    with database() as db:
        rows = db.execute("SELECT * FROM vault_notes ORDER BY id DESC LIMIT 500").fetchall()
    return {"items": [row_dict(row) for row in rows], "scope": "notes_only"}


@app.post("/api/vault/notes", status_code=201)
def create_vault_note(payload: VaultNoteCreate, _: None = Depends(require_access)):
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="محتوى الملاحظة لا يمكن أن يكون فارغاً.")
    if payload.source == "rooh" and not payload.owner_approved:
        raise HTTPException(status_code=403, detail="تحتاج روح إلى موافقتك الصريحة قبل إيداع أي ملاحظة.")
    with database() as db:
        cursor = db.execute(
            "INSERT INTO vault_notes(content,source,created_at) VALUES(?,?,?)",
            (content, payload.source, now()),
        )
        note_id = cursor.lastrowid
    audit("vault.note.created", f"ملاحظة #{note_id}؛ المصدر: {payload.source}.")
    return {"id": note_id, "source": payload.source, "saved": True}


@app.get("/api/audit")
def get_audit(limit: int = Query(default=30, ge=1, le=100), _: None = Depends(require_access)):
    with database() as db:
        rows = db.execute("SELECT * FROM audit ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return {"items": [row_dict(row) for row in rows]}


@app.get("/")
def root():
    return {"service": "SOULARAB TECH API", "docs": "/docs", "health": "/api/health"}


from .execution import register_execution_routes

register_execution_routes(app)
