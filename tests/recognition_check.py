"""Two checks added after the blind test, so neither was in prereg.md.

pixels: for each valid drawing, is the closest drawing from another prompt the same creature?
chains: does any guess in a recorded round name the monster the round started with?

Run: uv run --no-project --with pymupdf --with pillow --with numpy python tests/recognition_check.py
"""
import json
import re
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageFilter

ROOT = Path(__file__).parent.parent
CREATURES = ["moth", "goat", "lantern", "witch", "crab", "radio"]
SHUFFLES = 2000
START_WORDS = {
    "crab": ["crab", "lobster"],
    "bat": ["bat"],
    "ghost": ["ghost", "spirit"],
    "teapot": ["teapot", "kettle", "pot"],
    "skeleton": ["skeleton", "bones", "skull"],
    "cat": ["cat", "kitten", "feline"],
    "owl": ["owl"],
    "pumpkin": ["pumpkin"],
    "vampire": ["vampire", "dracula"],
}


def raster(svg: str) -> np.ndarray:
    page = pymupdf.open(stream=svg.replace('stroke-width="3"', 'stroke-width="6"').encode(), filetype="svg")[0]
    pixmap = page.get_pixmap(alpha=True)
    image = Image.frombytes("RGBA", (pixmap.width, pixmap.height), pixmap.samples)
    paper = Image.new("RGBA", image.size, "white")
    paper.alpha_composite(image)
    blurred = paper.convert("L").filter(ImageFilter.GaussianBlur(4)).resize((48, 48), Image.BILINEAR)
    return 1 - np.asarray(blurred, float).ravel() / 255


def pixels(rows: list[dict]) -> dict:
    kept = [row for row in rows if row["svg"]]
    prompts = np.array([row["monster"] for row in kept])
    labels = np.array([CREATURES.index(row["monster"].split()[1]) for row in kept])
    drawings = np.array([raster(row["svg"]) for row in kept])
    drawings -= drawings.mean(1, keepdims=True)
    drawings /= np.linalg.norm(drawings, axis=1, keepdims=True)
    similar = drawings @ drawings.T
    similar[prompts[:, None] == prompts[None, :]] = -9
    closest = similar.argmax(1)

    observed = (labels[closest] == labels).mean()
    rng = np.random.default_rng(0)
    unique = sorted(set(prompts))
    of_prompt = {p: labels[list(prompts).index(p)] for p in unique}
    shuffled = []
    for _ in range(SHUFFLES):
        moved = dict(zip(unique, rng.permutation([of_prompt[p] for p in unique])))
        fake = np.array([moved[p] for p in prompts])
        shuffled.append((fake[closest] == fake).mean())
    shuffled = np.array(shuffled)
    return {
        "drawings": len(kept),
        "same_creature": round(float(observed), 3),
        "chance": round(float(shuffled.mean()), 3),
        "p": round(float(((shuffled >= observed).sum() + 1) / (SHUFFLES + 1)), 4),
    }


def chains() -> list[dict]:
    rounds = []
    for chain in json.loads((ROOT / "data/chains.json").read_text())["chains"]:
        key = next(k for k in START_WORDS if re.search(rf"\b{k}\b", chain["start"]))
        words = "|".join(START_WORDS[key])
        guesses = [step["text"] for step in chain["steps"][1:] if step["kind"] != "drawing"]
        rounds.append({
            "start": chain["start"],
            "guesses": len(guesses),
            "named": sum(bool(re.search(rf"\b({words})\b", g, re.I)) for g in guesses),
        })
    return rounds


first = json.loads((ROOT / "data/results.json").read_text())["drawings"]
second = json.loads((ROOT / "data/artist-2-results.json").read_text())["drawings"]
models = {
    "base": first["base"],
    "student": first["student"],
    "artist-2": second["student"],
    "teacher": first["teacher"],
}
result = {"pixels": {name: pixels(rows) for name, rows in models.items()}, "chains": chains()}
(ROOT / "tests/recognition_check.json").write_text(json.dumps(result, indent=1) + "\n")
print(json.dumps(result, indent=1))
