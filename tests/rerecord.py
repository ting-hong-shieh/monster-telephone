"""Record chains through the live server, one take each, with the picture-reading listener."""
import json, time, urllib.request

BASE = "https://monster-telephone-ghosts.onrender.com/api/"


def post(path, body):
    request = urllib.request.Request(BASE + path, json.dumps(body).encode(), {"content-type": "application/json"})
    with urllib.request.urlopen(request, timeout=120) as reply:
        time.sleep(2.2)
        return json.load(reply)


def draw(text):
    return {"kind": "drawing", "svg": post("draw", {"whisper": text})["svg"]}


def guess(svg):
    return {"kind": "whisper", "text": post("whisper", {"svg": svg})["text"]}


def play(start, rescue=None):
    steps = [{"kind": "whisper", "text": start}]
    for turn in range(3):
        drawing = {"kind": "drawing", "svg": rescue} if rescue and turn == 1 else draw(steps[-1]["text"])
        if rescue and turn == 1:
            drawing["by"] = "player"
        steps.append(drawing)
        steps.append(guess(drawing["svg"]))
        print(start, turn, "|", steps[-1]["text"], flush=True)
    return {"start": start, "steps": steps}


old = json.load(open("data/chains.json"))
crab = json.load(open("tests/answers/drawings/crab.json"))
chains = [play("a crab with enormous claws", (crab.get("data") or crab)["svg"])]
for chain in old["chains"]:
    chains.append(play(chain["start"]))
done = {"artist": old["artist"], "listener": "Qwen/Qwen3.5-4B, reading a 448 px picture", "chains": chains}
json.dump(done, open("tests/chains-vision.json", "w"), indent=1)
print("saved", len(chains))
