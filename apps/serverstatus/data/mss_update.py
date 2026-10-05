"""Ask each machine's read-only :8767/status and write data/servers.json.

cpuU, memU, whatsinuse, and vram come from that JSON. A host that does not
answer is down. This does not start or stop anything on those machines.
"""
import json
import os
import subprocess
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.basename(HERE).lower() == "data":
    DATA = HERE
else:
    DATA = os.path.join(HERE, "data")
PATH = os.path.join(DATA, "servers.json")

# Tailscale addresses. desktop is left down when it does not answer.
HOSTS = [
    ("nimo", "100.86.192.3", 12),
    ("T1", "100.68.43.17", 12),
    ("mini48", "100.84.167.88", 15),
    ("MartyNPC1", "100.123.159.36", 12),
    ("up", "100.120.21.39", 12),
    ("desktop", "100.118.231.14", 3),
    ("3080", "100.124.236.23", 12),
    ("T2", "100.91.174.50", 12),
]


def updated_et():
    try:
        et = datetime.now(ZoneInfo("America/New_York"))
        text = et.strftime("%Y-%m-%d %I:%M %p ET")
        date, rest = text.split(" ", 1)
        if rest.startswith("0"):
            rest = rest[1:]
        return date + " " + rest
    except Exception:
        out = subprocess.check_output(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'Eastern Standard Time').ToString('yyyy-MM-dd h:mm tt')",
            ],
            text=True,
            errors="replace",
            timeout=20,
        ).strip()
        return out + " ET"


def down_row(name):
    return {
        "name": name,
        "up": False,
        "whatsinuse": "",
        "working_on": "",
        "cpuU": "",
        "memU": "",
        "vram": "",
        "queue1": "",
        "queue2": "",
        "queue3": "",
    }


def fmt_mib(mib):
    try:
        mib = float(mib)
    except Exception:
        return ""
    if mib <= 0:
        return "0 GB"
    gb = mib / 1024.0
    if gb >= 10:
        return "%.0f GB" % gb
    return "%.1f GB" % gb


def fmt_pair(used_mib, total_mib):
    def one(mib):
        gb = float(mib) / 1024.0
        if gb >= 10:
            return "%.0f" % gb
        return "%.1f" % gb

    return "%s / %s GB" % (one(used_mib), one(total_mib))


def fetch(ip, timeout):
    url = "http://%s:8767/status" % ip
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        return None


def row_from(name, data):
    if not isinstance(data, dict):
        return down_row(name)
    cpu = data.get("cpu_percent")
    cpu_u = ""
    if cpu is not None and cpu != "":
        try:
            cpu_u = "%d%%" % int(round(float(cpu)))
        except Exception:
            cpu_u = ""
    mem = data.get("memory") or {}
    mem_u = ""
    if isinstance(mem, dict) and mem.get("used_mib") is not None and mem.get("total_mib"):
        try:
            mem_u = fmt_pair(mem.get("used_mib"), mem.get("total_mib"))
        except Exception:
            mem_u = ""
    gpus = data.get("gpus")
    vram = ""
    if isinstance(gpus, list) and gpus:
        used = 0
        for gpu in gpus:
            try:
                used += int(gpu.get("memory_used_mib") or 0)
            except Exception:
                pass
        vram = fmt_mib(used)
    return {
        "name": name,
        "up": True,
        "whatsinuse": data.get("whatsinuse") or "",
        "working_on": data.get("working_on") or "",
        "cpuU": cpu_u,
        "memU": mem_u,
        "vram": vram,
        "queue1": "",
        "queue2": "",
        "queue3": "",
    }


def build_rows():
    results = {}
    with ThreadPoolExecutor(max_workers=len(HOSTS)) as pool:
        futures = {}
        for name, ip, timeout in HOSTS:
            futures[pool.submit(fetch, ip, timeout)] = name
        for future in as_completed(futures):
            name = futures[future]
            try:
                results[name] = future.result()
            except Exception:
                results[name] = None
    return [row_from(name, results.get(name)) for name, _ip, _timeout in HOSTS]


def main():
    servers = {"updated_et": updated_et(), "rows": build_rows()}
    os.makedirs(DATA, exist_ok=True)
    with open(PATH, "w", encoding="utf-8") as handle:
        json.dump(servers, handle, indent=2)
        handle.write("\n")
    print(json.dumps({"wrote": PATH, "updated_et": servers["updated_et"]}, indent=2))
    print(json.dumps(servers, indent=2))


if __name__ == "__main__":
    main()
