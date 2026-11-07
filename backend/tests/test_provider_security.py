import unittest

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


if __name__ == "__main__":
    unittest.main()