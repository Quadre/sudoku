from __future__ import annotations

import argparse
import http.server
import socketserver
from pathlib import Path


class StaticHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the Sudoku SPA locally.")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to.")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    handler = lambda *handler_args, **handler_kwargs: StaticHandler(
        *handler_args,
        directory=str(root),
        **handler_kwargs,
    )

    with socketserver.TCPServer(("127.0.0.1", args.port), handler) as httpd:
        print(f"Serving Sudoku SPA at http://127.0.0.1:{args.port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()