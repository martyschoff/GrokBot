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

# Tailscale addresses. The old "desktop" row was the 8x3080 and is not listed.
HOSTS = [
    ("nimo", "100.86.192.3", 12),
    ("T1", "100.68.43.17", 12),
    ("mini48", "100.84.167.88", 15),
    ("MartyNPC1", "100.123.159.36", 12),
    ("up", "100.120.21.39", 12),
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




def clean_work(work):
    """Drop queue counts and a bare 'loaded' note. Those are not a job."""
    kept = []
    for part in (work or "").split("."):
        part = part.strip()
        if not part:
            continue
        low = part.lower()
        if low == "loaded" or low == "kokoro off":
            continue
        if low.startswith("queue ") or low.startswith("inflight "):
            continue
        kept.append(part)
    return ". ".join(kept)


def with_loaded(label):
    label = (label or "").strip()
    if not label:
        return ""
    if "loaded" in label.lower():
        return label
    return label + " loaded"


def jobs_from(data):
    """One entry per loaded model or running job. Empty means the machine is idle."""
    if isinstance(data.get("jobs"), list):
        jobs = []
        for item in data["jobs"]:
            if isinstance(item, str) and item.strip():
                jobs.append({"whatsinuse": item.strip(), "working_on": ""})
            elif isinstance(item, dict):
                use = (item.get("whatsinuse") or "").strip()
                work = clean_work(item.get("working_on") or "")
                if use or work:
                    jobs.append({"whatsinuse": use, "working_on": work})
        return jobs
    jobs = []
    ollama = data.get("ollama")
    if isinstance(ollama, list):
        for name in ollama:
            name = str(name).strip()
            if not name:
                continue
            label = name if name.startswith("llama:") else "llama:" + name
            jobs.append({"whatsinuse": with_loaded(label), "working_on": ""})
    freetoken = data.get("freetoken") if isinstance(data.get("freetoken"), dict) else {}
    if freetoken.get("up"):
        model = str(freetoken.get("model") or "").strip()
        label = ("freetoken:" + model) if model else "freetoken"
        jobs.append({"whatsinuse": with_loaded(label), "working_on": ""})
    whisper = data.get("whisper") if isinstance(data.get("whisper"), dict) else {}
    if whisper.get("up"):
        jobs.append({"whatsinuse": "whisper", "working_on": "whisper :8080"})
    elif whisper.get("process"):
        jobs.append({"whatsinuse": "whisper", "working_on": "whisper process, port 8080 down"})
    try:
        workers = int(data.get("kokoro_workers") or 0)
    except Exception:
        workers = 0
    if workers > 0:
        jobs.append({"whatsinuse": "kokoro", "working_on": "kokoro workers %s" % workers})
    vllm = data.get("vllm") if isinstance(data.get("vllm"), dict) else {}
    if vllm.get("up"):
        models = vllm.get("models")
        if not isinstance(models, list) or not models:
            models = [vllm.get("model") or ""]
        for model in models:
            model = str(model or "").strip()
            label = ("vllm:" + model) if model else "vllm"
            jobs.append({
                "whatsinuse": with_loaded(label),
                "working_on": clean_work(vllm.get("working_on") or ""),
            })
    elif vllm.get("starting"):
        jobs.append({"whatsinuse": "vllm", "working_on": "starting"})
    if jobs:
        return jobs
    use = (data.get("whatsinuse") or "").strip()
    work = clean_work(data.get("working_on") or "")
    parts = [part.strip() for part in use.split(",") if part.strip()]
    if len(parts) > 1:
        return [{"whatsinuse": part, "working_on": work if i == 0 else ""} for i, part in enumerate(parts)]
    if parts or work:
        return [{"whatsinuse": parts[0] if parts else "", "working_on": work}]
    return []


def probe_vllm(ip):
    """Read-only. A model line only if port 8000 is already serving one."""
    url = "http://%s:8000/v1/models" % ip
    try:
        with urllib.request.urlopen(url, timeout=1.5) as resp:
            body = json.loads(resp.read().decode())
    except Exception:
        return None
    if not isinstance(body, dict) or not isinstance(body.get("data"), list):
        return None
    models = []
    for item in body["data"]:
        if isinstance(item, dict) and item.get("id"):
            models.append(str(item["id"]))
    return {"up": True, "starting": False, "model": models[0] if models else "", "models": models, "port": 8000}


def attach_vllm(ip, data):
    if not isinstance(data, dict):
        return data
    current = data.get("vllm")
    if isinstance(current, dict) and (current.get("up") or current.get("starting")):
        return data
    found = probe_vllm(ip)
    if not found:
        return data
    data = dict(data)
    data["vllm"] = found
    return data


def machine_stats(data):
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
    return cpu_u, mem_u, vram


def row_from(name, data):
    """One board record per machine. lines is one entry per model or job."""
    if not isinstance(data, dict):
        return down_row(name)
    cpu_u, mem_u, vram = machine_stats(data)
    lines = jobs_from(data)
    if not lines:
        lines = [{"whatsinuse": "", "working_on": ""}]
    first = lines[0]
    return {
        "name": name,
        "up": True,
        "whatsinuse": first.get("whatsinuse") or "",
        "working_on": first.get("working_on") or "",
        "cpuU": cpu_u,
        "memU": mem_u,
        "vram": vram,
        "lines": lines,
    }


def build_rows():
    results = {}
    with ThreadPoolExecutor(max_workers=len(HOSTS)) as pool:
        futures = {}
        for name, ip, timeout in HOSTS:
            futures[pool.submit(fetch, ip, timeout)] = (name, ip)
        for future in as_completed(futures):
            name, ip = futures[future]
            try:
                results[name] = attach_vllm(ip, future.result())
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
