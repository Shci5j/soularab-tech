import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import main


class ReleaseReadinessSecurityTests(unittest.TestCase):
    def client_with_settings(self, data_dir, *, token="", environment="local"):
        return patch.multiple(
            main,
            DATA_DIR=data_dir,
            DB_PATH=data_dir / "release-readiness.sqlite3",
            API_TOKEN=token,
            APP_ENV=environment,
        )

    def test_production_api_requires_a_bearer_token(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.client_with_settings(Path(temp), environment="production"):
                with TestClient(main.app) as client:
                    self.assertEqual(client.get("/api/health").status_code, 200)
                    self.assertEqual(client.get("/api/projects").status_code, 503)

    def test_production_api_accepts_only_the_configured_bearer_token(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.client_with_settings(Path(temp), token="release-secret", environment="production"):
                with TestClient(main.app) as client:
                    self.assertEqual(client.get("/api/projects").status_code, 401)
                    self.assertEqual(
                        client.get("/api/projects", headers={"Authorization": "Bearer wrong"}).status_code,
                        401,
                    )
                    allowed = client.get(
                        "/api/projects",
                        headers={"Authorization": "Bearer release-secret"},
                    )
                    self.assertEqual(allowed.status_code, 200)

    def test_execution_cannot_write_into_an_archived_project(self):
        with tempfile.TemporaryDirectory() as temp:
            data_dir = Path(temp)
            with self.client_with_settings(data_dir):
                with TestClient(main.app) as client:
                    project = client.post("/api/projects", json={"title": "Archived project"}).json()
                    task = client.post(
                        "/api/tasks",
                        json={"title": "Write release note", "department": "files"},
                    ).json()
                    archived = client.post(f"/api/projects/{project['id']}/archive")
                    self.assertEqual(archived.status_code, 200)

                    response = client.post(
                        f"/api/tasks/{task['id']}/execute",
                        json={
                            "action": "write_project_note",
                            "project_id": project["id"],
                            "filename": "release.md",
                            "content": "# Release",
                        },
                    )
                    self.assertEqual(response.status_code, 409)
                    self.assertFalse(
                        (data_dir / "workspaces" / str(project["id"]) / "release.md").exists()
                    )
                    current = client.get("/api/tasks").json()["items"][0]
                    self.assertEqual(current["status"], "queued")

    def test_execution_rejects_a_symlink_that_escapes_the_project(self):
        with tempfile.TemporaryDirectory() as temp:
            data_dir = Path(temp)
            outside = data_dir / "outside.txt"
            outside.write_text("must remain unchanged", encoding="utf-8")
            with self.client_with_settings(data_dir):
                with TestClient(main.app) as client:
                    project = client.post("/api/projects", json={"title": "Symlink project"}).json()
                    task = client.post(
                        "/api/tasks",
                        json={"title": "Write safe note", "department": "files"},
                    ).json()
                    workspace = data_dir / "workspaces" / str(project["id"])
                    (workspace / "escape.txt").symlink_to(outside)

                    response = client.post(
                        f"/api/tasks/{task['id']}/execute",
                        json={
                            "action": "write_project_note",
                            "project_id": project["id"],
                            "filename": "escape.txt",
                            "content": "malicious overwrite",
                        },
                    )
                    self.assertEqual(response.status_code, 409)
                    self.assertEqual(outside.read_text(encoding="utf-8"), "must remain unchanged")
                    current = client.get("/api/tasks").json()["items"][0]
                    self.assertEqual(current["status"], "queued")


if __name__ == "__main__":
    unittest.main()
