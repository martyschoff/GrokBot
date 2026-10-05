"""Board file server. Bind the tailnet address, not the LAN, unless --bind says otherwise."""
import argparse
import os
import subprocess
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def tailscale_ipv4():
    out = subprocess.check_output(["tailscale", "ip", "-4"], text=True, timeout=10)
    ip = ""
    for line in out.splitlines():
        line = line.strip()
        if line:
            ip = line
            break
    if not ip:
        raise SystemExit("no tailscale ipv4")
    return ip


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--tailnet", action="store_true")
    args = parser.parse_args()
    bind = tailscale_ipv4() if args.tailnet else args.bind
    os.chdir(os.path.dirname(os.path.abspath(sys.argv[0])))
    server = ThreadingHTTPServer((bind, args.port), NoCacheRequestHandler)
    print("listening on %s:%s" % (bind, args.port), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
