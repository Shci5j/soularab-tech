import unittest

from app.main import ImageWorkflowRequest, safe_filename, validate_comfy_workflow, validate_local_media_url


def safe_image_workflow():
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "studio-model.safetensors"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "A studio portrait", "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "blurry", "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {
            "seed": 1234, "steps": 24, "cfg": 7, "sampler_name": "euler",
            "scheduler": "normal", "denoise": 1,
            "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0],
        }},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "SOULARAB"}},
    }


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


    def test_standard_ui_workflow_is_allowed(self):
        validate_comfy_workflow(safe_image_workflow())

    def test_arbitrary_node_types_and_extra_nodes_are_rejected(self):
        workflow = safe_image_workflow()
        workflow["7"]["class_type"] = "PythonExecution"
        with self.assertRaises(ValueError):
            validate_comfy_workflow(workflow)
        workflow = safe_image_workflow()
        workflow["8"] = {"class_type": "CustomNode", "inputs": {}}
        with self.assertRaises(ValueError):
            validate_comfy_workflow(workflow)

    def test_unsafe_checkpoint_paths_are_rejected(self):
        workflow = safe_image_workflow()
        workflow["1"]["inputs"]["ckpt_name"] = "../outside/model.safetensors"
        with self.assertRaises(ValueError):
            validate_comfy_workflow(workflow)

    def test_image_dimensions_and_graph_references_are_bounded(self):
        workflow = safe_image_workflow()
        workflow["4"]["inputs"]["width"] = 4096
        with self.assertRaises(ValueError):
            validate_comfy_workflow(workflow)
        workflow = safe_image_workflow()
        workflow["5"]["inputs"]["positive"] = ["99", 0]
        with self.assertRaises(ValueError):
            validate_comfy_workflow(workflow)


if __name__ == "__main__":
    unittest.main()
