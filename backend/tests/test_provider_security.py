import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from app import main
from app.main import ChatRequest, validate_local_llama_url


class LocalProviderSecurityTests(unittest.TestCase):
    def test_accepts_loopback_ipv4(self):
        self.assertEqual(validate_local_llama_url("http://127.0.0.1:8081/"), "http://127.0.0.1:8081")

    def test_accepts_localhost(self):
        self.assertEqual(validate_local_llama_url("http://localhost:8081"), "http://localhost:8081")

    def test_rejects_public_host(self):
        for value in ("https://example.com", "http://example.com:8081"):
            with self.assertRaises(ValueError):
                validate_local_llama_url(value)

    def test_rejects_private_lan_ip(self):
        with self.assertRaises(ValueError):
            validate_local_llama_url("http://192.168.1.10:8081")

    def test_rejects_credentials(self):
        with self.assertRaises(ValueError):
            validate_local_llama_url("http://user:pass@127.0.0.1:8081")

    def test_rejects_non_http_scheme(self):
        with self.assertRaises(ValueError):
            validate_local_llama_url("https://127.0.0.1:8081")


class LlamaCppApiTests(unittest.TestCase):
    def test_assistant_status_reports_llama_cpp_provider(self):
        async def fake_request(path, payload=None):
            self.assertEqual(path, "/health")
            return {"status": "ok"}

        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with patch.multiple(main, DATA_DIR=data, DB_PATH=data / "llama.sqlite3", API_TOKEN="", APP_ENV="local"), patch.object(main, "llama_cpp_request", fake_request):
                with TestClient(main.app) as client:
                    response = client.get("/api/assistant/status")
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()["provider"], "llama_cpp")
                    self.assertTrue(response.json()["connected"])

    def test_assistant_models_use_openai_compatible_model_ids(self):
        async def fake_request(path, payload=None):
            self.assertEqual(path, "/v1/models")
            return {"data": [{"id": "rooh-local"}, {"id": "qwen2.5-3b"}]}

        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with patch.multiple(main, DATA_DIR=data, DB_PATH=data / "models.sqlite3", API_TOKEN="", APP_ENV="local"), patch.object(main, "llama_cpp_request", fake_request):
                with TestClient(main.app) as client:
                    response = client.get("/api/assistant/models")
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual([item["name"] for item in response.json()["items"]], ["rooh-local", "qwen2.5-3b"])

    def test_chat_uses_openai_compatible_completion_shape(self):
        async def fake_request(path, payload=None):
            if path == "/v1/models":
                return {"data": [{"id": "rooh-local"}]}
            self.assertEqual(path, "/v1/chat/completions")
            self.assertEqual(payload["model"], "rooh-local")
            return {"choices": [{"message": {"role": "assistant", "content": "أنا روح"}}]}

        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with patch.multiple(main, DATA_DIR=data, DB_PATH=data / "chat.sqlite3", API_TOKEN="", APP_ENV="local"), patch.object(main, "llama_cpp_request", fake_request):
                with TestClient(main.app) as client:
                    response = client.post("/api/assistant/chat", json={"model": "rooh-local", "messages": [{"role": "user", "content": "من أنت؟"}]})
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()["message"]["content"], "أنا روح")

    def test_chat_rejects_unknown_model(self):
        async def fake_request(path, payload=None):
            return {"data": [{"id": "other-model"}]}

        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with patch.multiple(main, DATA_DIR=data, DB_PATH=data / "missing.sqlite3", API_TOKEN="", APP_ENV="local"), patch.object(main, "llama_cpp_request", fake_request):
                with TestClient(main.app) as client:
                    response = client.post("/api/assistant/chat", json={"model": "rooh-local", "messages": [{"role": "user", "content": "hello"}]})
                    self.assertEqual(response.status_code, 404)


import tempfile
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from app import main


class ProjectApiTests(unittest.TestCase):
    def test_create_list_archive_project_and_keep_workspace(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            with patch.object(main, "DATA_DIR", data_dir), patch.object(main, "DB_PATH", data_dir / "test.sqlite3"), patch.object(main, "API_TOKEN", ""), patch.object(main, "APP_ENV", "local"):
                with TestClient(main.app) as client:
                    created = client.post("/api/projects", json={"title": "Test Workspace", "description": "A test project"})
                    self.assertEqual(created.status_code, 201)
                    project_id = created.json()["id"]
                    self.assertTrue((data_dir / "workspaces" / str(project_id)).is_dir())

                    listed = client.get("/api/projects")
                    self.assertEqual(listed.status_code, 200)
                    self.assertEqual(listed.json()["items"][0]["title"], "Test Workspace")

                    archived = client.post(f"/api/projects/{project_id}/archive")
                    self.assertEqual(archived.status_code, 200)
                    self.assertEqual(archived.json()["status"], "archived")
                    self.assertTrue((data_dir / "workspaces" / str(project_id)).is_dir())

    def test_upload_list_download_and_reject_unsafe_names(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            with patch.object(main, "DATA_DIR", data_dir), patch.object(main, "DB_PATH", data_dir / "files.sqlite3"), patch.object(main, "API_TOKEN", ""), patch.object(main, "APP_ENV", "local"):
                with TestClient(main.app) as client:
                    created = client.post("/api/projects", json={"title": "Files Project"})
                    project_id = created.json()["id"]

                    uploaded = client.post(f"/api/projects/{project_id}/files", files={"file": ("notes.txt", b"hello world", "text/plain")})
                    self.assertEqual(uploaded.status_code, 201)
                    listed = client.get(f"/api/projects/{project_id}/files")
                    self.assertEqual(listed.json()["items"][0]["name"], "notes.txt")

                    downloaded = client.get(f"/api/projects/{project_id}/files/notes.txt")
                    self.assertEqual(downloaded.content, b"hello world")

                    deleted = client.delete(f"/api/projects/{project_id}/files/notes.txt")
                    self.assertEqual(deleted.status_code, 200)
                    self.assertTrue(deleted.json()["deleted"])
                    self.assertFalse((data_dir / "workspaces" / str(project_id) / "notes.txt").exists())
                    missing = client.delete(f"/api/projects/{project_id}/files/notes.txt")
                    self.assertEqual(missing.status_code, 404)

                    traversal = client.post(f"/api/projects/{project_id}/files", files={"file": ("../escape.txt", b"x", "text/plain")})
                    self.assertEqual(traversal.status_code, 400)
                    executable = client.post(f"/api/projects/{project_id}/files", files={"file": ("payload.exe", b"x", "application/octet-stream")})
                    self.assertEqual(executable.status_code, 415)
                    archived = client.post(f"/api/projects/{project_id}/archive")
                    self.assertEqual(archived.status_code, 200)
                    denied = client.post(f"/api/projects/{project_id}/files", files={"file": ("later.txt", b"x", "text/plain")})
                    self.assertEqual(denied.status_code, 409)


class SecurityPostureEndpointTests(unittest.TestCase):
    def test_security_status_requires_token_and_never_exposes_it(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with patch.multiple(main, DATA_DIR=data, DB_PATH=data / "security.sqlite3", API_TOKEN="test-secret-token", APP_ENV="production"):
                with TestClient(main.app) as client:
                    denied = client.get("/api/security/status")
                    self.assertEqual(denied.status_code, 401)
                    response = client.get("/api/security/status", headers={"Authorization": "Bearer test-secret-token"})
                    self.assertEqual(response.status_code, 200)
                    payload = response.json()
                    self.assertEqual(payload["access_mode"], "bearer_token")
                    self.assertTrue(payload["token_configured"])
                    self.assertFalse(payload["account_management"])
                    self.assertEqual(payload["identity_model"], "single_shared_api_token")
                    self.assertNotIn("test-secret-token", response.text)

    def test_local_security_status_explains_no_token_mode(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with patch.multiple(main, DATA_DIR=data, DB_PATH=data / "local-security.sqlite3", API_TOKEN="", APP_ENV="local"):
                with TestClient(main.app) as client:
                    response = client.get("/api/security/status")
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()["access_mode"], "local_without_token")
                    self.assertFalse(response.json()["token_configured"])


class ChatTemperatureValidationTests(unittest.TestCase):
    def test_temperature_accepts_supported_range(self):
        base = {"model": "local-model", "messages": [{"role": "user", "content": "Hello"}]}
        self.assertEqual(ChatRequest(**base, temperature=0).temperature, 0)
        self.assertEqual(ChatRequest(**base, temperature=2).temperature, 2)
        self.assertEqual(ChatRequest(**base).temperature, 0.7)

    def test_temperature_rejects_values_outside_supported_range(self):
        base = {"model": "local-model", "messages": [{"role": "user", "content": "Hello"}]}
        for value in (-0.1, 2.1):
            with self.assertRaises(Exception):
                ChatRequest(**base, temperature=value)


if __name__ == "__main__":
    unittest.main()
