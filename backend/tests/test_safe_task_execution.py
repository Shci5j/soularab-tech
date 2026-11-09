import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from app import main


class SafeTaskExecutionTests(unittest.TestCase):
    def isolated_client(self, data_dir):
        return patch.multiple(main, DATA_DIR=data_dir, DB_PATH=data_dir / "test.sqlite3", API_TOKEN="", APP_ENV="local")

    def test_approved_task_can_write_only_a_text_artifact(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with self.isolated_client(data):
                with TestClient(main.app) as client:
                    project = client.post("/api/projects", json={"title": "Release notes"}).json()
                    plan = client.post("/api/agent-plans", json={
                        "title": "Prepare release note",
                        "description": "Write a short release note in the project workspace",
                    }).json()
                    denied = client.post(f"/api/tasks/{plan['task_id']}/execute", json={
                        "action": "write_project_note", "project_id": project["id"],
                        "filename": "release.md", "content": "# Release",
                    })
                    self.assertEqual(denied.status_code, 409)

                    client.post(f"/api/approvals/{plan['approval_id']}/decision", json={"decision": "approved"})
                    response = client.post(f"/api/tasks/{plan['task_id']}/execute", json={
                        "action": "write_project_note", "project_id": project["id"],
                        "filename": "release.md", "content": "# Release\n\nReady.",
                    })
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()["status"], "completed")
                    self.assertEqual((data / "workspaces" / str(project["id"]) / "release.md").read_text(), "# Release\n\nReady.")
                    events = client.get(f"/api/tasks/{plan['task_id']}/events").json()["items"]
                    self.assertEqual([e["to_status"] for e in events], ["completed", "running", "queued", "waiting_approval"])

    def test_execution_rejects_unsupported_actions_and_file_types(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with self.isolated_client(data):
                with TestClient(main.app) as client:
                    project = client.post("/api/projects", json={"title": "Docs"}).json()
                    task = client.post("/api/tasks", json={"title": "Write a note", "department": "files"}).json()
                    unsupported = client.post(f"/api/tasks/{task['id']}/execute", json={
                        "action": "run_shell", "project_id": project["id"], "filename": "x.txt", "content": "x",
                    })
                    self.assertEqual(unsupported.status_code, 422)
                    blocked = client.post(f"/api/tasks/{task['id']}/execute", json={
                        "action": "write_project_note", "project_id": project["id"], "filename": "run.sh", "content": "echo unsafe",
                    })
                    self.assertEqual(blocked.status_code, 415)
                    current = client.get("/api/tasks").json()["items"][0]
                    self.assertEqual(current["status"], "queued")

    def test_partial_artifact_is_removed_when_write_fails(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with self.isolated_client(data):
                with TestClient(main.app) as client:
                    project = client.post("/api/projects", json={"title": "Docs"}).json()
                    task = client.post("/api/tasks", json={"title": "Write a note", "department": "files"}).json()
                    target = data / "workspaces" / str(project["id"]) / "partial.txt"
                    original_open = Path.open

                    class FailingWriter:
                        def __init__(self, handle):
                            self.handle = handle
                        def __enter__(self):
                            return self
                        def __exit__(self, *args):
                            self.handle.close()
                        def write(self, _content):
                            self.handle.write("partial")
                            self.handle.flush()
                            raise OSError("simulated disk write failure")

                    def failing_open(path, *args, **kwargs):
                        handle = original_open(path, *args, **kwargs)
                        if path == target:
                            return FailingWriter(handle)
                        return handle

                    payload = {"action": "write_project_note", "project_id": project["id"], "filename": "partial.txt", "content": "complete"}
                    with patch.object(Path, "open", autospec=True, side_effect=failing_open):
                        response = client.post(f"/api/tasks/{task['id']}/execute", json=payload)
                    self.assertEqual(response.status_code, 500)
                    self.assertFalse(target.exists())
                    current = client.get("/api/tasks").json()["items"][0]
                    self.assertEqual(current["status"], "failed")

    def test_completed_task_cannot_execute_twice(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with self.isolated_client(data):
                with TestClient(main.app) as client:
                    project = client.post("/api/projects", json={"title": "Docs"}).json()
                    task = client.post("/api/tasks", json={"title": "Write a note", "department": "files"}).json()
                    payload = {"action": "write_project_note", "project_id": project["id"], "filename": "note.txt", "content": "hello"}
                    self.assertEqual(client.post(f"/api/tasks/{task['id']}/execute", json=payload).status_code, 200)
                    self.assertEqual(client.post(f"/api/tasks/{task['id']}/execute", json=payload).status_code, 409)


    def test_inventory_export_lists_metadata_without_reading_sensitive_files(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with self.isolated_client(data):
                with TestClient(main.app) as client:
                    project = client.post("/api/projects", json={"title": "Inventory", "description": "Project files"}).json()
                    workspace = data / "workspaces" / str(project["id"])
                    workspace.mkdir(parents=True, exist_ok=True)
                    (workspace / "README.md").write_text("PRIVATE DOCUMENT BODY", encoding="utf-8")
                    (workspace / ".env").write_text("API_SECRET=do-not-report", encoding="utf-8")
                    (workspace / "identity.pem").write_text("PRIVATE KEY MATERIAL", encoding="utf-8")
                    outside = data / "outside.txt"
                    outside.write_text("OUTSIDE CONTENT", encoding="utf-8")
                    try:
                        (workspace / "linked.txt").symlink_to(outside)
                    except OSError:
                        pass
                    task = client.post("/api/tasks", json={"title": "Export inventory", "department": "files"}).json()
                    response = client.post(f"/api/tasks/{task['id']}/execute", json={
                        "action": "export_project_inventory",
                        "project_id": project["id"],
                        "filename": "inventory.md",
                    })
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()["status"], "completed")
                    report = (workspace / "inventory.md").read_text(encoding="utf-8")
                    self.assertIn("README.md", report)
                    self.assertNotIn(".env", report)
                    self.assertNotIn("identity.pem", report)
                    self.assertNotIn("PRIVATE DOCUMENT BODY", report)
                    self.assertNotIn("API_SECRET", report)
                    self.assertNotIn("PRIVATE KEY MATERIAL", report)
                    self.assertNotIn("OUTSIDE CONTENT", report)
                    self.assertIn("لا يتضمن هذا التقرير محتويات الملفات", report)
                    events = client.get(f"/api/tasks/{task['id']}/events").json()["items"]
                    self.assertEqual([event["to_status"] for event in events], ["completed", "running", "queued"])


if __name__ == "__main__":
    unittest.main()
