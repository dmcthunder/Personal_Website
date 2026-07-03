#!/usr/bin/env python3
"""Mirror www.diogomaiacaetano.com (Figma Sites) into this folder."""
import os, re, sys, urllib.request

BASE = "https://www.diogomaiacaetano.com"
OUT = os.path.dirname(os.path.abspath(__file__))

PAGES = {"/": "index.html", "/about": "about/index.html", "/404": "404.html"}
ASSET_RE = re.compile(r'/_(?:assets|json|runtimes)/[A-Za-z0-9._/\-]+')

downloaded = set()

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (mirror)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def save(path, data):
    full = os.path.join(OUT, path.lstrip("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as f:
        f.write(data)
    return full

def dl_asset(path):
    if path in downloaded:
        return None
    downloaded.add(path)
    try:
        data = fetch(BASE + path)
    except Exception as e:
        print(f"  SKIP {path}: {e}", file=sys.stderr)
        return None
    save(path, data)
    print(f"  {path} ({len(data)} bytes)")
    return data

def extract_refs(data):
    text = data.decode("utf-8", errors="ignore")
    return ASSET_RE.findall(text)

queue = []
for route, fname in PAGES.items():
    try:
        data = fetch(BASE + route)
    except Exception as e:
        print(f"page {route} failed: {e}", file=sys.stderr)
        continue
    save(fname, data)
    print(f"PAGE {route} -> {fname} ({len(data)} bytes)")
    queue.extend(extract_refs(data))

while queue:
    path = queue.pop()
    data = dl_asset(path)
    if data and path.endswith((".js", ".json", ".html", ".css", ".svg")):
        queue.extend(p for p in extract_refs(data) if p not in downloaded)

print(f"\nDone. {len(downloaded)} assets downloaded.")
