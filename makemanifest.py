import datetime as dt
import os

ROOT_INCLUDE = [
    "index.html",
    "favicon.ico",
    "labpage.css",
    "registry.js",
    "state.js",
    "test_patterns.js",
    "ui.js",
    "ui_builder.js",
    "widgets.js",
    "cache-worker.js",
    "manifest.json",
    "big_icon.png"
]

def findish():
    manifest_entries = []
    for dn, _, fns in os.walk("."):
        if dn == "." or ".git" in dn or ".idea" in dn or "__pycache__" in dn:
            continue
        manifest_entries += [f"{dn}/{fn}" for fn in fns]
    return manifest_entries


def make_manifest():
    return findish() + [f"./{fn}" for fn in ROOT_INCLUDE]


def generate_serviceworker():
    return f"""const CACHE_NAME = 'vandal-cache-{dt.datetime.now().timestamp()}';
const ASSETS_TO_CACHE = {make_manifest()};

self.addEventListener('install', event => {{
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {{
        for (let a of ASSETS_TO_CACHE) {{
            console.log(a)
            cache.add(a)
        }}
    }}));
}});

self.addEventListener('activate', event => {{self.clients.claim();}});

self.addEventListener('fetch', event => {{
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
}});
    """


def write_serviceworker():
    with open("cache-worker.js", "w") as stream:
        stream.write(generate_serviceworker())

