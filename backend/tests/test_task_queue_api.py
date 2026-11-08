import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from app import main


class TaskQueueApiTests(unittest.TestCase):
    def test_tasks_are_queued_and_never_execute_automatically(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            with patch.object(main, "DATA_DIR", data_dir), patch.object(main, "DB_PATH", data_dir / "test.sqlite3"), patch.object(main, "API_TOKEN", ""), patch.object(main, "APP_ENV", "local"):
                with TestClient(main.app) as client:
                    created = client.post("/api/tasks", json={
                        "title": "Design the workspace",
                        "description": "Prepare the first visual pass",
                        "department": "work",
                    })
                    self.assertEqual(created.status_code, 201)
                    self.assertEqual(created.json()["status"], "queued")
                    self.assertEqual(created.json()["execution"], "not_started")

                    listed = client.get("/api/tasks")
                    self.assertEqual(listed.status_code, 200)
                    self.assertEqual(listed.json()["items"][0]["title"], "Design the workspace")

                    cancelled = client.post(f"/api/tasks/{created.json()['id']}/cancel")
                    self.assertEqual(cancelled.status_code, 200)
                    self.assertEqual(cancelled.json()["status"], "cancelled")
                    self.assertEqual(cancelled.json()["execution"], "not_started")

    def test_task_cannot_be_cancelled_twice_or_after_terminal_state(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            with patch.object(main, "DATA_DIR", data_dir), patch.object(main, "DB_PATH", data_dir / "test.sqlite3"), patch.object(main, "API_TOKEN", ""), patch.object(main, "APP_ENV", "local"):
                with TestClient(main.app) as client:
                    created = client.post("/api/tasks", json={
                        "title": "Review the interface",
                        "department": "work",
                    })
                    task_id = created.json()["id"]
                    self.assertEqual(client.post(f"/api/tasks/{task_id}/cancel").status_code, 200)
                    self.assertEqual(client.post(f"/api/tasks/{task_id}/cancel").status_code, 409)

    def test_running_task_is_not_marked_cancelled_without_a_stop_engine(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            with patch.object(main, "DATA_DIR", data_dir), patch.object(main, "DB_PATH", data_dir / "test.sqlite3"), patch.object(main, "API_TOKEN", ""), patch.object(main, "APP_ENV", "local"):
                with TestClient(main.app) as client:
                    created = client.post("/api/tasks", json={"title": "Build the app", "department": "system"})
                    task_id = created.json()["id"]
                    with main.database() as db:
                        db.execute("UPDATE tasks SET status='running' WHERE id=?", (task_id,))
                    response = client.post(f"/api/tasks/{task_id}/cancel")
                    self.assertEqual(response.status_code, 409)
                    current = client.get("/api/tasks").json()["items"][0]
                    self.assertEqual(current["status"], "running")


    def test_task_filters_and_invalid_departments(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            with patch.object(main, "DATA_DIR", data_dir), patch.object(main, "DB_PATH", data_dir / "test.sqlite3"), patch.object(main, "API_TOKEN", ""), patch.object(main, "APP_ENV", "local"):
                with TestClient(main.app) as client:
                    client.post("/api/tasks", json={"title": "Build media UI", "department": "work"})
                    self.assertEqual(len(client.get("/api/tasks?status=queued").json()["items"]), 1)
                    self.assertEqual(client.post("/api/tasks", json={"title": "Bad task", "department": "unknown"}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
