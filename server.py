import json
import os
import socket
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


PROJECT_DIR = Path(__file__).resolve().parent
MAX_REQUEST_BYTES = 64 * 1024
MAX_MESSAGE_CHARS = 4000
MAX_HISTORY_MESSAGES = 12
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
SYSTEM_INSTRUCTION = (
    "You are a capable, friendly general-purpose assistant. Answer a wide range of "
    "questions clearly and helpfully. Be honest when uncertain, and do not claim to "
    "have taken actions you cannot take. When users ask about Northstar Construction, "
    "help with general construction information and recommend contacting the company "
    "for project-specific quotes, site assessments, or licensed professional advice."
)


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def load_dotenv():
    env_path = PROJECT_DIR / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        key = key.strip()
        if not separator or not key or key.startswith("#") or key in os.environ:
            continue

        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ[key] = value


def validate_history(history):
    if not isinstance(history, list):
        raise ApiError(400, "Chat history must be a list.")

    normalized = []
    for item in history[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(item, dict) or item.get("role") not in {"user", "model"}:
            raise ApiError(400, "Chat history contains an invalid message.")

        parts = item.get("parts")
        if not isinstance(parts, list) or not parts:
            raise ApiError(400, "Chat history contains an invalid message.")

        text_parts = []
        for part in parts:
            if not isinstance(part, dict) or not isinstance(part.get("text"), str):
                raise ApiError(400, "Chat history contains an invalid message.")
            if len(part["text"]) > MAX_MESSAGE_CHARS:
                raise ApiError(400, "A chat message is too long.")
            text_parts.append({"text": part["text"]})

        normalized.append({"role": item["role"], "parts": text_parts})
    return normalized


def get_gemini_answer(message, history):
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ApiError(503, "Gemini is not configured. Add GEMINI_API_KEY to your .env file and restart the server.")

    model = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash").strip()
    if not model:
        raise ApiError(500, "GEMINI_MODEL cannot be empty.")

    contents = validate_history(history)
    contents.append({"role": "user", "parts": [{"text": message}]})
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048},
    }
    request = Request(
        f"{GEMINI_API_BASE}/{quote(model, safe='')}:generateContent?key={quote(api_key, safe='')}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        if error.code == 429:
            raise ApiError(429, "Gemini's usage limit was reached. Please try again later.") from error
        if error.code in {401, 403}:
            raise ApiError(502, "Gemini rejected the API key. Check that it is valid and enabled.") from error
        if error.code == 404:
            raise ApiError(502, "Gemini could not find the configured model. Check GEMINI_MODEL.") from error
        raise ApiError(502, f"Gemini could not complete the request (HTTP {error.code}).") from error
    except URLError as error:
        if isinstance(error.reason, (TimeoutError, socket.timeout)):
            raise ApiError(504, "Gemini took too long to respond. Please try again.") from error
        raise ApiError(502, "Could not connect to Gemini. Check the server's internet connection.") from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ApiError(502, "Gemini returned an invalid response.") from error
    except (TimeoutError, socket.timeout) as error:
        raise ApiError(504, "Gemini took too long to respond. Please try again.") from error

    if not isinstance(result, dict) or not isinstance(result.get("candidates"), list):
        raise ApiError(502, "Gemini returned an invalid response.")

    answer_parts = []
    for candidate in result["candidates"]:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content")
        if not isinstance(content, dict) or not isinstance(content.get("parts"), list):
            continue
        for part in content["parts"]:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                answer_parts.append(part["text"])
    answer = "".join(answer_parts).strip()
    if not answer:
        raise ApiError(502, "Gemini did not return an answer. Please rephrase your question and try again.")
    return answer


class WebsiteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_DIR), **kwargs)

    def translate_path(self, path):
        translated = Path(super().translate_path(path)).resolve()
        try:
            relative_path = translated.relative_to(PROJECT_DIR)
        except ValueError:
            return str(PROJECT_DIR / "__not_found__")

        if any(part.startswith(".") or part == "__pycache__" for part in relative_path.parts):
            return str(PROJECT_DIR / "__not_found__")
        if translated.suffix in {".md", ".py", ".pyc"}:
            return str(PROJECT_DIR / "__not_found__")
        return str(translated)

    def list_directory(self, path):
        self.send_error(404, "File not found")
        return None

    def send_json(self, status, payload):
        response = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(response)

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_json(404, {"error": "API endpoint not found."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Invalid request length."})
            return
        if content_length <= 0:
            self.send_json(400, {"error": "Request body is required."})
            return
        if content_length > MAX_REQUEST_BYTES:
            self.send_json(413, {"error": "Request is too large."})
            return

        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"error": "Request body must be valid JSON."})
            return

        if not isinstance(payload, dict):
            self.send_json(400, {"error": "Request body must be a JSON object."})
            return
        message = payload.get("message")
        if not isinstance(message, str) or not message.strip():
            self.send_json(400, {"error": "Enter a message before sending."})
            return
        message = message.strip()
        if len(message) > MAX_MESSAGE_CHARS:
            self.send_json(400, {"error": f"Messages must be {MAX_MESSAGE_CHARS} characters or fewer."})
            return

        history = payload.get("history", [])
        try:
            answer = get_gemini_answer(message, history)
        except ApiError as error:
            self.send_json(error.status, {"error": str(error)})
            return

        self.send_json(200, {"answer": answer})

    def log_message(self, format_string, *args):
        sys.stderr.write(f"{self.address_string()} - {format_string % args}\n")


def main():
    load_dotenv()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer((host, port), WebsiteHandler)
    print(f"Northstar website running at http://{host}:{port}")
    print("Press Ctrl+C to stop the server.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
