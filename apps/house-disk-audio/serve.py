#!/usr/bin/env python3
"""Serve a house disk (netfs) over HTTP on a Tailscale address only.

Listens on a 100.64.0.0/10 address so the socket is not on the LAN NIC
or the public internet. There is no port forward. AWS is left alone.
"""

from __future__ import annotations

import argparse
import ipaddress
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

TAILSCALE_NET = ipaddress.ip_network("100.64.0.0/10")
DEFAULT_BIND = "100.73.201.124"
DEFAULT_PORT = 8765
DEFAULT_ROOT = r"I:\\"


class TailnetFileHandler(SimpleHTTPRequestHandler):
    """Static files plus CORS so a player on another origin can fetch audio."""

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Range")
        self.send_header("Access-Control-Expose-Headers", "Accept-Ranges, Content-Range, Content-Length")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.end_headers()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tailnet-only file server for netfs")
    parser.add_argument("--bind", default=DEFAULT_BIND, help="Tailscale IPv4 to listen on")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--root", default=DEFAULT_ROOT, help="Directory to serve")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    addr = ipaddress.ip_address(args.bind)
    if not isinstance(addr, ipaddress.IPv4Address) or addr not in TAILSCALE_NET:
        print(f"refusing to bind {args.bind}: not in {TAILSCALE_NET}", file=sys.stderr)
        return 2
    handler = partial(TailnetFileHandler, directory=args.root)
    httpd = ThreadingHTTPServer((str(addr), args.port), handler)
    print(f"serving {args.root} at http://{addr}:{args.port}/", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("stopped", flush=True)
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
