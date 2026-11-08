import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from app import main


class TaskAndVaultNoteApiTests(unittest.TestCase):
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

    def test_rooh_cannot_write_vault_note_without_owner_approval(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            with patch.object(main, "DATA_DIR", data_dir), patch.object(main, "DB_PATH", data_dir / "test.sqlite3"), patch.object(main, "API_TOKEN", ""), patch.object(main, "APP_ENV", "local"):
                with TestClient(main.app) as client:
                    denied = client.post("/api/vault/notes", json={
                        "content": "https://github.com/example/repository",
                        "source": "rooh",
                        "owner_approved": False,
                    })
                    self.assertEqual(denied.status_code, 403)

                    accepted = client.post("/api/vault/notes", json={
                        "content": "https://github.com/example/repository",
                        "source": "rooh",
                        "owner_approved": True,
                    })
                    self.assertEqual(accepted.status_code, 201)

                    notes = client.get("/api/vault/notes")
                    self.assertEqual(notes.status_code, 200)
                    self.assertEqual(notes.json()["scope"], "notes_only")
                    self.assertEqual(len(notes.json()["items"]), 1)


if __name__ == "__main__":
    unittest.main()
