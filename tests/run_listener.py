"""Send drawings through the live listener and score the guesses by word match."""
import json, re, sys, time, urllib.request

URL = "https://monster-telephone-ghosts.onrender.com/api/whisper"
WORDS = {
    "moth": ["moth", "butterfly"], "goat": ["goat", "ram", "sheep"], "lantern": ["lantern", "lamp"],
    "witch": ["witch", "wizard", "sorceress"], "crab": ["crab", "lobster"], "radio": ["radio", "stereo", "speaker"],
}


def hit(text, creature):
    return any(re.search(rf"\b{w}s?\b", text.lower()) for w in WORDS[creature])


def ask(svg):
    request = urllib.request.Request(URL, json.dumps({"svg": svg}).encode(), {"content-type": "application/json"})
    began = time.time()
    with urllib.request.urlopen(request, timeout=120) as reply:
        body = json.load(reply)
    return body["text"], time.time() - began


rows = json.load(open(sys.argv[1]))
out = []
for row in rows:
    for turn in range(3):
        text, seconds = ask(row["svg"])
        others = [c for c in WORDS if c != row["creature"]]
        out.append({"creature": row["creature"], "guess": text, "seconds": round(seconds, 2), "own": hit(text, row["creature"]), "other": sum(hit(text, c) for c in others) / 5})
        print(row["creature"], "|", text, "|", round(seconds, 1), flush=True)
        time.sleep(2.2)
json.dump(out, open(sys.argv[2], "w"), indent=0)
own = sum(r["own"] for r in out) / len(out)
other = sum(r["other"] for r in out) / len(out)
times = sorted(r["seconds"] for r in out)
verdict = "PASS" if own >= .3 and own >= 3 * other else "PARTIAL" if own >= .1 and own >= 2 * other else "FAIL"
print(f"own {sum(r['own'] for r in out)}/{len(out)} = {own:.3f}  control {other:.3f}  {verdict}  first {out[0]['seconds']}s  median {times[len(times)//2]}s  max {times[-1]}s")
