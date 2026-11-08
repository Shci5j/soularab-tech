import io
import tempfile
import unittest
import zipfile
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


    def test_project_export_contains_files_and_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            data_dir = Path(temp)
            with self.client_with_settings(data_dir):
                with TestClient(main.app) as client:
                    project = client.post(
                        "/api/projects",
                        json={"title": "Export project", "description": "Archive test"},
                    ).json()
                    workspace = data_dir / "workspaces" / str(project["id"])
                    (workspace / "readme.md").write_text("# Exported", encoding="utf-8")

                    response = client.get(f"/api/projects/{project['id']}/export")
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.headers["content-type"], "application/zip")
                    self.assertIn(f'soularab-project-{project["id"]}.zip', response.headers["content-disposition"])
                    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
                        self.assertEqual(set(archive.namelist()), {"project.json", "readme.md"})
                        self.assertEqual(archive.read("readme.md").decode("utf-8"), "# Exported")
                        metadata = archive.read("project.json").decode("utf-8")
                        self.assertIn("Export project", metadata)
                        self.assertIn('"status": "active"', metadata)

    def test_project_export_skips_symlinks_and_does_not_read_outside_files(self):
        with tempfile.TemporaryDirectory() as temp:
            data_dir = Path(temp)
            outside = data_dir / "outside.txt"
            outside.write_text("private external data", encoding="utf-8")
            with self.client_with_settings(data_dir):
                with TestClient(main.app) as client:
                    project = client.post("/api/projects", json={"title": "Symlink export"}).json()
                    workspace = data_dir / "workspaces" / str(project["id"])
                    (workspace / "inside.txt").write_text("safe", encoding="utf-8")
                    (workspace / "outside-link.txt").symlink_to(outside)

                    response = client.get(f"/api/projects/{project['id']}/export")
                    self.assertEqual(response.status_code, 200)
                    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
                        self.assertEqual(set(archive.namelist()), {"project.json", "inside.txt"})
                        self.assertNotIn("private external data", archive.read("inside.txt").decode("utf-8"))
                    self.assertEqual(outside.read_text(encoding="utf-8"), "private external data")

    def test_project_export_requires_authentication_in_production(self):
        with tempfile.TemporaryDirectory() as temp:
            data_dir = Path(temp)
            with self.client_with_settings(data_dir, token="release-secret", environment="production"):
                with TestClient(main.app) as client:
                    project = client.post(
                        "/api/projects",
                        json={"title": "Protected export"},
                        headers={"Authorization": "Bearer release-secret"},
                    ).json()
                    self.assertEqual(client.get(f"/api/projects/{project['id']}/export").status_code, 401)
                    allowed = client.get(
                        f"/api/projects/{project['id']}/export",
                        headers={"Authorization": "Bearer release-secret"},
                    )
                    self.assertEqual(allowed.status_code, 200)


    def test_project_archive_import_restores_safe_files_into_a_new_workspace(self):
        with tempfile.TemporaryDirectory() as temp:
            data_dir = Path(temp)
            archive_buffer = io.BytesIO()
            with zipfile.ZipFile(archive_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr(
                    "project.json",
                    '{"title":"Original project","description":"Restore me","status":"active"}',
                )
                archive.writestr("readme.md", "# Restored safely")
                archive.writestr("notes.txt", "second file")
            with self.client_with_settings(data_dir):
                with TestClient(main.app) as client:
                    response = client.post(
                        "/api/projects/import",
                        files={"file": ("project.zip", archive_buffer.getvalue(), "application/zip")},
                    )
                    self.assertEqual(response.status_code, 201)
                    result = response.json()
                    self.assertEqual(result["restored_files"], 2)
                    self.assertEqual(result["status"], "active")
                    workspace = data_dir / "workspaces" / str(result["id"])
                    self.assertEqual((workspace / "readme.md").read_text(encoding="utf-8"), "# Restored safely")
                    self.assertEqual((workspace / "notes.txt").read_text(encoding="utf-8"), "second file")
                    self.assertFalse((workspace / "project.json").exists())

    def test_project_archive_import_rejects_path_traversal_without_creating_project(self):
        with tempfile.TemporaryDirectory() as temp:
            data_dir = Path(temp)
            archive_buffer = io.BytesIO()
            with zipfile.ZipFile(archive_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("project.json", '{"title":"Malicious project"}')
                archive.writestr("../outside.txt", "must not escape")
            with self.client_with_settings(data_dir):
                with TestClient(main.app) as client:
                    response = client.post(
                        "/api/projects/import",
                        files={"file": ("malicious.zip", archive_buffer.getvalue(), "application/zip")},
                    )
                    self.assertEqual(response.status_code, 400)
                    self.assertFalse((data_dir / "outside.txt").exists())
                    self.assertEqual(client.get("/api/projects").json()["items"], [])

    def test_project_archive_import_rejects_symlink_entries(self):
        with tempfile.TemporaryDirectory() as temp:
            data_dir = Path(temp)
            archive_buffer = io.BytesIO()
            with zipfile.ZipFile(archive_buffer, "w") as archive:
                archive.writestr("project.json", '{"title":"Symlink project"}')
                link = zipfile.ZipInfo("escape.txt")
                link.create_system = 3
                link.external_attr = (0o120777 << 16)
                archive.writestr(link, "../outside.txt")
            with self.client_with_settings(data_dir):
                with TestClient(main.app) as client:
                    response = client.post(
                        "/api/projects/import",
                        files={"file": ("symlink.zip", archive_buffer.getvalue(), "application/zip")},
                    )
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(client.get("/api/projects").json()["items"], [])

    def test_project_archive_import_requires_production_authentication(self):
        with tempfile.TemporaryDirectory() as temp:
            archive_buffer = io.BytesIO()
            with zipfile.ZipFile(archive_buffer, "w") as archive:
                archive.writestr("project.json", '{"title":"Protected restore"}')
            with self.client_with_settings(Path(temp), token="release-secret", environment="production"):
                with TestClient(main.app) as client:
                    payload = {"file": ("project.zip", archive_buffer.getvalue(), "application/zip")}
                    self.assertEqual(client.post("/api/projects/import", files=payload).status_code, 401)
                    allowed = client.post(
                        "/api/projects/import",
                        files=payload,
                        headers={"Authorization": "Bearer release-secret"},
                    )
                    self.assertEqual(allowed.status_code, 201)


if __name__ == "__main__":
    unittest.main()
