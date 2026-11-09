import unittest
from pydantic import ValidationError

from app.main import MeshNodeCreate


class MeshNodeValidationTests(unittest.TestCase):
    def test_accepts_loopback_node(self):
        node = MeshNodeCreate(name="Phone", role="A", base_url="http://127.0.0.1:8000")
        self.assertEqual(node.base_url, "http://127.0.0.1:8000")

    def test_accepts_private_lan_node(self):
        node = MeshNodeCreate(name="Laptop", role="D", base_url="http://192.168.1.25:8000/")
        self.assertEqual(node.base_url, "http://192.168.1.25:8000")

    def test_rejects_public_or_named_hosts(self):
        for address in ("https://example.com", "http://example.com:8000", "http://8.8.8.8:8000"):
            with self.subTest(address=address):
                with self.assertRaises(ValidationError):
                    MeshNodeCreate(name="Untrusted", role="E", base_url=address)

    def test_rejects_credentials_and_paths(self):
        for address in ("http://user:pass@192.168.1.2:8000", "http://192.168.1.2:8000/admin"):
            with self.subTest(address=address):
                with self.assertRaises(ValidationError):
                    MeshNodeCreate(name="Invalid", role="B", base_url=address)


if __name__ == "__main__":
    unittest.main()
