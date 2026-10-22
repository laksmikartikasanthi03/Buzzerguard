"""
 Web Server & REST API untuk Sistem Deteksi Otomatis Akun Buzzer Sintetis
 Berbasis Python Standard Library (Zero-Dependency, langsung berjalan di Python 3.x)
"""

import os
import json
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from detector_engine import (
    JOURNAL_SAMPLE_CASES,
    PROMPT_INJECTION_TEMPLATES,
    DETECTOR_SYSTEM_PROMPT,
    analyze_comment_stylistic,
    simulate_bot_injection_response,
    call_external_llm_analysis,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class BuzzerDetectorHTTPHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def _send_json(self, data: dict, status_code: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json({"status": "ok"}, 200)

    def do_GET(self):
        if self.path == "/api/init":
            # Evaluasi semua sampel jurnal secara otomatis agar tabel langsung terisi
            evaluated_cases = []
            for item in JOURNAL_SAMPLE_CASES:
                analysis = analyze_comment_stylistic(
                    comment_text=item["comment_text"],
                    persona_claim=item["persona_claim"],
                    username=item["username"],
                )
                evaluated_cases.append({**item, "live_analysis": analysis})

            self._send_json({
                "status": "ok",
                "journal_info": {
                    "title": "PEMANFAATAN LLM SEBAGAI SISTEM DETEKSI OTOMATIS AKUN BUZZER SINTETIS DI MEDIA SOSIAL",
                    "author": "Ni Komang Laksmi Kartika Santhi",
                    "affiliation": "Fakultas Teknologi Informasi, ITB STIKOM Bali",
                    "email": "laksmi@stikom-bali.ac.id",
                    "system_prompt": DETECTOR_SYSTEM_PROMPT,
                },
                "sample_cases": evaluated_cases,
                "injection_templates": PROMPT_INJECTION_TEMPLATES,
            })
            return

        # Serve static files (index.html, styles.css, app.js, etc.)
        return super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON body"}, 400)
            return

        if self.path == "/api/analyze":
            comment_text = payload.get("comment_text", "")
            persona_claim = payload.get("persona_claim", "Masyarakat Umum / Kasual")
            username = payload.get("username", "@user_sosmed")
            api_key = payload.get("api_key", "")
            provider = payload.get("provider", "gemini")

            if not comment_text.strip():
                self._send_json({"error": "Teks komentar tidak boleh kosong."}, 400)
                return

            result = analyze_comment_stylistic(
                comment_text=comment_text,
                persona_claim=persona_claim,
                username=username,
            )

            llm_response = None
            if api_key and api_key.strip():
                llm_response = call_external_llm_analysis(
                    comment_text=comment_text,
                    persona_claim=persona_claim,
                    api_key=api_key,
                    provider=provider,
                )

            result["external_llm_insight"] = llm_response
            self._send_json({"status": "ok", "result": result})
            return

        if self.path == "/api/inject":
            injection_payload = payload.get("injection_payload", "")
            bot_persona = payload.get("bot_persona", "Ibu-Ibu Laundry (@ibu_laundry_berkah99)")
            defense_stage = int(payload.get("defense_stage", 1))

            if not injection_payload.strip():
                self._send_json({"error": "Instruksi Prompt Injection tidak boleh kosong."}, 400)
                return

            sim_result = simulate_bot_injection_response(
                injection_payload=injection_payload,
                bot_persona=bot_persona,
                defense_stage=defense_stage,
            )
            self._send_json({"status": "ok", "simulation": sim_result})
            return

        if self.path == "/api/batch":
            items = payload.get("items", [])
            results = []
            for idx, entry in enumerate(items):
                text = entry.get("comment_text", "")
                persona = entry.get("persona_claim", "Warganet Kasual")
                user = entry.get("username", f"@akun_uji_{idx+1}")
                if text.strip():
                    results.append(analyze_comment_stylistic(text, persona, user))
            self._send_json({"status": "ok", "results": results})
            return

        self._send_json({"error": "Endpoint tidak ditemukan"}, 404)


def run_server(port: int = 8501):
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, BuzzerDetectorHTTPHandler)
    print("=" * 72)
    print(" SISTEM DETEKSI OTOMATIS AKUN BUZZER SINTETIS (BERBASIS LLM)")
    print(" Fakultas Teknologi Informasi - ITB STIKOM Bali")
    print(f" Server aktif di: http://localhost:{port}")
    print("=" * 72)
    httpd.serve_forever()


if __name__ == "__main__":
    run_server(8501)
