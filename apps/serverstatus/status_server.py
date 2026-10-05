#!/usr/bin/env python3
"""Read-only machine status. GET /status only.

Does not start or stop Ollama, Whisper, Kokoro, or FreeToken.
"""
from __future__ import annotations

import json
import platform
import re
import shutil
import socket
import subprocess
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "0.0.0.0"
PORT = 8767
SYSTEM = platform.system()

if SYSTEM == "Windows":
    KOKORO_ROOT = Path(r"D:\kokoro-nt")
    QUEUE = KOKORO_ROOT / "queue"
    INFLIGHT = KOKORO_ROOT / "inflight"
    VENV_PY = r"d:\kokoro-stress-redo\venv\scripts\python.exe"
    CHILD_PY = r"d:\kokoro-stress-redo\python\python.exe"
else:
    KOKORO_ROOT = Path("/no/such/kokoro")
    QUEUE = KOKORO_ROOT / "queue"
    INFLIGHT = KOKORO_ROOT / "inflight"
    VENV_PY = ""
    CHILD_PY = ""


def file_count(folder: Path) -> int:
    if not folder.is_dir():
        return 0
    try:
        return sum(1 for p in folder.iterdir() if p.is_file())
    except Exception:
        return 0


def port_answers(port: int) -> bool:
    sock = socket.socket()
    sock.settimeout(1.0)
    try:
        sock.connect(("127.0.0.1", port))
        return True
    except Exception:
        return False
    finally:
        try:
            sock.close()
        except Exception:
            pass


def _as_list(data):
    if isinstance(data, dict):
        return [data]
    if isinstance(data, list):
        return data
    return []


def windows_snapshot():
    script = (
        "$cpu = (Get-CimInstance Win32_Processor | "
        "Measure-Object -Property LoadPercentage -Average).Average; "
        "$os = Get-CimInstance Win32_OperatingSystem; "
        "$procs = Get-CimInstance Win32_Process | "
        "Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine; "
        "@{cpu=$cpu; total_kb=$os.TotalVisibleMemorySize; free_kb=$os.FreePhysicalMemory; procs=$procs} | "
        "ConvertTo-Json -Compress -Depth 4"
    )
    out = subprocess.check_output(
        ["powershell", "-NoProfile", "-Command", script],
        text=True,
        errors="replace",
        timeout=30,
    )
    data = json.loads(out)
    total_kb = float(data.get("total_kb") or 0)
    free_kb = float(data.get("free_kb") or 0)
    cpu = data.get("cpu")
    cpu_pct = None if cpu is None else round(float(cpu), 1)
    used_mib = max(0.0, (total_kb - free_kb) / 1024.0)
    total_mib = total_kb / 1024.0
    return cpu_pct, used_mib, total_mib, _as_list(data.get("procs"))


def _mac_cpu():
    out = subprocess.check_output(
        ["top", "-l", "2", "-n", "0"],
        text=True,
        errors="replace",
        timeout=15,
    )
    cpu = None
    for line in out.splitlines():
        if line.startswith("CPU usage:"):
            match = re.search(r"([\d.]+)%\s+idle", line)
            if match:
                cpu = round(100.0 - float(match.group(1)), 1)
    return cpu


def _mac_mem():
    total = int(subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True, timeout=5).strip())
    vm = subprocess.check_output(["vm_stat"], text=True, errors="replace", timeout=5)
    page = 4096
    page_match = re.search(r"page size of (\d+) bytes", vm)
    if page_match:
        page = int(page_match.group(1))
    counts = {}
    for line in vm.splitlines():
        match = re.match(r"(.+?):\s+(\d+)\.", line)
        if match:
            counts[match.group(1).strip()] = int(match.group(2))
    used_pages = (
        counts.get("Pages active", 0)
        + counts.get("Pages wired down", 0)
        + counts.get("Pages occupied by compressor", 0)
    )
    return used_pages * page / (1024.0 * 1024.0), total / (1024.0 * 1024.0)


def linux_cpu_mem():
    def read_stat():
        parts = open("/proc/stat", "r", encoding="utf-8").readline().split()[1:]
        nums = [int(x) for x in parts]
        idle = nums[3] + (nums[4] if len(nums) > 4 else 0)
        return idle, sum(nums)

    import time

    idle1, total1 = read_stat()
    time.sleep(0.4)
    idle2, total2 = read_stat()
    delta = total2 - total1
    cpu = None
    if delta > 0:
        cpu = round(100.0 * (delta - (idle2 - idle1)) / delta, 1)
    meminfo = open("/proc/meminfo", "r", encoding="utf-8").read()
    vals = {}
    for line in meminfo.splitlines():
        match = re.match(r"(\w+):\s+(\d+)", line)
        if match:
            vals[match.group(1)] = int(match.group(2))
    total_kb = float(vals.get("MemTotal") or 0)
    avail_kb = float(vals.get("MemAvailable") or vals.get("MemFree") or 0)
    used_mib = max(0.0, (total_kb - avail_kb) / 1024.0)
    return cpu, used_mib, total_kb / 1024.0


def cpu_mem_procs():
    try:
        if SYSTEM == "Windows":
            return windows_snapshot()
        if SYSTEM == "Darwin":
            cpu = _mac_cpu()
            used, total = _mac_mem()
            return cpu, used, total, []
        cpu, used, total = linux_cpu_mem()
        return cpu, used, total, []
    except Exception:
        return None, None, None, []


def gpu_from_text(*texts):
    blob = " ".join(t or "" for t in texts)
    match = re.search(r"CUDA_VISIBLE_DEVICES[= ]+(\d+)", blob, re.I)
    if not match:
        return None
    return int(match.group(1))


def kokoro_worker_count(procs) -> int:
    if SYSTEM != "Windows":
        return 0
    by_id = {}
    for proc in procs:
        try:
            by_id[int(proc.get("ProcessId"))] = proc
        except Exception:
            continue
    count = 0
    for proc in procs:
        exe = (proc.get("ExecutablePath") or "").lower()
        cmd = proc.get("CommandLine") or ""
        if not VENV_PY or exe != VENV_PY:
            continue
        if CHILD_PY and exe == CHILD_PY:
            continue
        if "worker.py" not in cmd.lower():
            continue
        parent = by_id.get(int(proc.get("ParentProcessId") or 0))
        parent_cmd = (parent or {}).get("CommandLine") or ""
        gpu = gpu_from_text(cmd, parent_cmd)
        if gpu == 0:
            continue
        if gpu is not None and not (1 <= gpu <= 7):
            continue
        count += 1
    return count


def whisper_state(procs) -> dict:
    running = False
    if SYSTEM == "Windows":
        for proc in procs:
            name = (proc.get("Name") or "").lower()
            exe = (proc.get("ExecutablePath") or "").lower()
            if name == "whisper-server.exe" or exe.endswith("\\whisper-server.exe"):
                running = True
                break
    else:
        try:
            out = subprocess.check_output(["ps", "-ax", "-o", "comm="], text=True, errors="replace", timeout=5)
            running = any("whisper-server" in line for line in out.splitlines())
        except Exception:
            running = False
    listening = port_answers(8080) if running else False
    return {"process": running, "port_8080": listening, "up": bool(running and listening)}


def gpu_memory():
    exe = shutil.which("nvidia-smi")
    if not exe:
        return []
    try:
        out = subprocess.check_output(
            [exe, "--query-gpu=index,memory.used,memory.total", "--format=csv,noheader,nounits"],
            text=True,
            errors="replace",
            timeout=15,
        )
    except Exception:
        return []
    rows = []
    for line in out.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 3:
            continue
        try:
            rows.append(
                {
                    "index": int(parts[0]),
                    "memory_used_mib": int(float(parts[1])),
                    "memory_total_mib": int(float(parts[2])),
                }
            )
        except Exception:
            continue
    return rows


def get_json(url, timeout=1.5):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        return None


def ollama_models():
    data = get_json("http://127.0.0.1:11434/api/ps", 1.5)
    if not isinstance(data, dict):
        return []
    names = []
    for model in data.get("models") or []:
        name = (model.get("name") or model.get("model") or "").strip()
        if name:
            names.append(name)
    return names


def freetoken_state():
    data = get_json("http://127.0.0.1:1919/v1/models", 1.5)
    if not isinstance(data, dict):
        return {"up": False, "model": ""}
    model = ""
    items = data.get("data") or []
    if items and isinstance(items, list) and isinstance(items[0], dict):
        model = str(items[0].get("id") or "")
    return {"up": True, "model": model}


def whats_in_use(ollama, freetoken, whisper, workers) -> str:
    parts = []
    for name in ollama:
        parts.append(name if name.startswith("llama:") else "llama:" + name)
    if freetoken.get("up"):
        model = freetoken.get("model") or ""
        parts.append("freetoken:" + model if model else "freetoken")
    if whisper.get("up"):
        parts.append("whisper")
    if workers > 0:
        parts.append("kokoro")
    return ", ".join(parts)


def working_line(whisper, workers, queue, inflight, use) -> str:
    parts = []
    if whisper.get("up"):
        parts.append("whisper :8080")
    elif whisper.get("process"):
        parts.append("whisper process, port 8080 down")
    if SYSTEM == "Windows" and KOKORO_ROOT.is_dir():
        if workers > 0:
            parts.append("kokoro workers %s" % workers)
        else:
            parts.append("kokoro off")
        parts.append("queue %s" % queue)
        parts.append("inflight %s" % inflight)
    elif use and not parts:
        parts.append("loaded")
    elif use:
        parts.append("loaded")
    return ". ".join(parts)


def status() -> dict:
    cpu, used_mib, total_mib, procs = cpu_mem_procs()
    whisper = whisper_state(procs)
    workers = kokoro_worker_count(procs)
    queue = file_count(QUEUE)
    inflight = file_count(INFLIGHT)
    ollama = ollama_models()
    token = freetoken_state()
    use = whats_in_use(ollama, token, whisper, workers)
    memory = None
    if used_mib is not None and total_mib:
        memory = {"used_mib": round(used_mib, 1), "total_mib": round(total_mib, 1)}
    return {
        "cpu_percent": cpu,
        "memory": memory,
        "whatsinuse": use,
        "working_on": working_line(whisper, workers, queue, inflight, use),
        "whisper": whisper,
        "kokoro_workers": workers,
        "queue": queue,
        "inflight": inflight,
        "gpus": gpu_memory(),
        "ollama": ollama,
        "freetoken": token,
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path != "/status":
            body = b'{"error":"not found"}\n'
            code = 404
        else:
            body = (json.dumps(status()) + "\n").encode("utf-8")
            code = 200
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
