"""Measure end-to-end latency of the local server."""
import json, statistics, sys, time, urllib.request as u
B = "http://127.0.0.1:8803"
def post(p, d):
    r = u.Request(B + p, json.dumps(d).encode(), {"content-type": "application/json"})
    return json.load(u.urlopen(r, timeout=90))
T = {"draw": [], "whisper": []}
for w in ["a moth with a mouth on its belly", "a very sad radio with long legs", "a goat wearing a tiny crown", "a witch afraid of her own hat", "a crab holding a telephone", "a lantern that is melting"]:
    a = time.time(); d = post("/api/draw", {"whisper": w}); T["draw"].append(time.time() - a)
    a = time.time(); g = post("/api/whisper", {"svg": d["svg"]}); T["whisper"].append(time.time() - a)
    print(w, "=>", g["text"], flush=True)
for k, v in T.items():
    print(k, "mean %.1f max %.1f" % (statistics.mean(v), max(v)))
print(json.load(u.urlopen(B + "/api/health")))
