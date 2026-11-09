import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from app import main
from app.main import validate_local_provider_url


class LocalProviderSecurityTests(unittest.TestCase):
    def test_accepts_loopback_ipv4(self):
        self.assertEqual(validate_local_provider_url("http://127.0.0.1:11434/"), "http://127.0.0.1:11434")

    def test_accepts_localhost(self):
        self.assertEqual(validate_local_provider_url("http://localhost:11434"), "http://localhost:11434")

    def test_rejects_public_host(self):
        with self.assertRaises(ValueError):
            validate_local_provider_url("https://example.com")

    def test_rejects_private_lan_ip(self):
        with self.assertRaises(ValueError):
            validate_local_provider_url("http://192.168.1.10:11434")

    def test_rejects_credentials(self):
        with self.assertRaises(ValueError):
            validate_local_provider_url("http://user:pass@127.0.0.1:11434")


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


if __name__ == "__main__":
    unittest.main()
