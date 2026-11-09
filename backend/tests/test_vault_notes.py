import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from app import main


class VaultNotesApiTests(unittest.TestCase):
    def test_rooh_requires_explicit_owner_approval(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            with patch.object(main, "DATA_DIR", data_dir), patch.object(main, "DB_PATH", data_dir / "test.sqlite3"), patch.object(main, "API_TOKEN", ""), patch.object(main, "APP_ENV", "local"):
                with TestClient(main.app) as client:
                    denied = client.post("/api/vault/notes", json={"content": "private note", "source": "rooh", "owner_approved": False})
                    self.assertEqual(denied.status_code, 403)
                    accepted = client.post("/api/vault/notes", json={"content": "approved note", "source": "rooh", "owner_approved": True})
                    self.assertEqual(accepted.status_code, 201)
                    notes = client.get("/api/vault/notes")
                    self.assertEqual(notes.status_code, 200)
                    self.assertEqual(notes.json()["scope"], "notes_only")
                    self.assertEqual(len(notes.json()["items"]), 1)

    def test_owner_can_save_notes_and_empty_content_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            with patch.object(main, "DATA_DIR", data_dir), patch.object(main, "DB_PATH", data_dir / "test.sqlite3"), patch.object(main, "API_TOKEN", ""), patch.object(main, "APP_ENV", "local"):
                with TestClient(main.app) as client:
                    saved = client.post("/api/vault/notes", json={"content": "  personal note  ", "source": "owner"})
                    self.assertEqual(saved.status_code, 201)
                    empty = client.post("/api/vault/notes", json={"content": "   ", "source": "owner"})
                    self.assertEqual(empty.status_code, 422)


if __name__ == "__main__":
    unittest.main()
