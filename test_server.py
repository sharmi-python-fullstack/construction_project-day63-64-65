import json
import os
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from server import ApiError, get_gemini_answer, validate_history


class FakeResponse:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return self.payload


class GeminiProxyTests(unittest.TestCase):
    @patch.dict(os.environ, {"GEMINI_API_KEY": "test-key", "GEMINI_MODEL": "test-model"})
    @patch("server.urlopen")
    def test_sends_conversation_and_returns_answer(self, mock_urlopen):
        mock_urlopen.return_value = FakeResponse({
            "candidates": [{"content": {"parts": [{"text": "Hello"}]}}]
        })

        answer = get_gemini_answer(
            "Hi",
            [{"role": "user", "parts": [{"text": "Earlier question"}]}],
        )

        self.assertEqual(answer, "Hello")
        request = mock_urlopen.call_args.args[0]
        self.assertIn("test-key", request.full_url)
        request_body = json.loads(request.data)
        self.assertEqual(request_body["contents"][-1]["parts"][0]["text"], "Hi")
        self.assertEqual(request_body["contents"][0]["parts"][0]["text"], "Earlier question")
        self.assertNotIn("test-key", json.dumps(request_body))

    @patch.dict(os.environ, {}, clear=True)
    def test_missing_api_key_is_reported(self):
        with self.assertRaises(ApiError) as context:
            get_gemini_answer("Hi", [])

        self.assertEqual(context.exception.status, 503)

    @patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"})
    @patch("server.urlopen")
    def test_quota_error_is_reported(self, mock_urlopen):
        mock_urlopen.side_effect = HTTPError("https://example.test", 429, "Too Many Requests", {}, None)

        with self.assertRaises(ApiError) as context:
            get_gemini_answer("Hi", [])

        self.assertEqual(context.exception.status, 429)
        self.assertIn("usage limit", str(context.exception))

    def test_rejects_malformed_history(self):
        with self.assertRaises(ApiError):
            validate_history([{"role": "system", "parts": [{"text": "bad"}]}])


if __name__ == "__main__":
    unittest.main()
