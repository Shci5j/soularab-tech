import unittest

from app.main import ImageWorkflowRequest, safe_filename, validate_local_media_url


class MediaProviderConfigurationTests(unittest.TestCase):
    def test_loopback_url_is_accepted(self):
        self.assertEqual(
            validate_local_media_url("http://127.0.0.1:8188/", "COMFYUI_BASE_URL"),
            "http://127.0.0.1:8188",
        )

    def test_remote_ip_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_local_media_url("http://8.8.8.8:8188", "COMFYUI_BASE_URL")

    def test_remote_hostname_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_local_media_url("https://example.com", "WHISPER_CPP_BASE_URL")

    def test_docker_alias_requires_explicit_opt_in(self):
        with self.assertRaises(ValueError):
            validate_local_media_url("http://comfyui:8188", "COMFYUI_BASE_URL")

    def test_workflow_request_requires_non_empty_workflow(self):
        with self.assertRaises(Exception):
            ImageWorkflowRequest(workflow={})

    def test_audio_filename_keeps_safe_basename(self):
        self.assertEqual(safe_filename("recording.wav"), "recording.wav")

    def test_audio_filename_rejects_paths(self):
        with self.assertRaises(Exception):
            safe_filename("../recording.wav")


if __name__ == "__main__":
    unittest.main()
