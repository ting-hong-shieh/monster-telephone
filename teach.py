"""Have a large open model draw monsters, then keep the clean drawings as training data."""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import tinker

from probe import BRIEF, encode

CREATURES = """bat spider ghost cat skeleton jellyfish owl crow rat toad snake moth wolf goat
eel squid crab beetle worm snail fish bear pumpkin scarecrow witch vampire mummy zombie
candle teapot chair umbrella clock lantern mirror telephone radio boot""".split()
HELD_OUT = ["moth", "goat", "lantern", "witch", "crab", "radio"]
TRAITS = """with too many teeth|with three eyes|with one enormous eye|with human feet|with long thin arms|
wearing a tiny crown|with a second head|with tentacles|covered in spikes|with bat wings|made of bones|with no face|
with a very long neck|with a mouth on its belly|with horns|with a forked tongue|with stitches|that is melting""".replace("\n", "").split("|")
MOODS = """holding a telephone|afraid of its own shadow|sitting on a broken chair|crying|grinning|hiding behind a door|
dancing|asleep on a grave|waving hello|carrying a lantern|eating a sock|looking very polite""".replace("\n", "").split("|")


def prompts(count: int, seed: int, held_out: bool) -> list[str]:
    rng = random.Random(seed)
    pool = HELD_OUT if held_out else [c for c in CREATURES if c not in HELD_OUT]
    made: list[str] = []
    while len(made) < count:
        words = [f"a {rng.choice(pool)}", rng.choice(TRAITS)]
        if rng.random() < 0.6:
            words.append(rng.choice(MOODS))
        monster = " ".join(words).replace("a a", "an a").replace("a o", "an o").replace("a e", "an e").replace("a u", "an u")
        if monster not in made:
            made.append(monster)
    return made


def compact(svg: str | None) -> str | None:
    """Reduce a drawing to bare path data, or reject it."""
    if not svg:
        return None
    try:
        root = ET.fromstring(re.sub(r'\sxmlns="[^"]*"', "", svg))
    except ET.ParseError:
        return None
    paths = []
    for node in root.iter():
        if node.tag == "path":
            if node.get("fill") not in (None, "none"):
                return None
            paths.append(re.sub(r"\s+", " ", node.get("d", "")).strip())
        elif node.tag not in ("svg", "g"):
            return None
    numbers = [float(n) for d in paths for n in re.findall(r"-?\d+\.?\d*", d)]
    if not 3 <= len(paths) <= 14 or not numbers or max(numbers) > 300 or not all(re.match(r"^[Mm]", d) for d in paths):
        return None
    body = "".join(f'<path d="{d}"/>' for d in paths)
    return None if len(body) > 2200 else f'<svg viewBox="0 0 256 256" fill="none" stroke="black" stroke-width="3">{body}</svg>'


async def one(client, tokenizer, monster: str, limit: asyncio.Semaphore) -> dict:
    async with limit:
        result = await client.sample_async(
            prompt=tinker.ModelInput.from_ints(encode(tokenizer, BRIEF.format(monster=monster))),
            num_samples=1,
            sampling_params=tinker.SamplingParams(max_tokens=1100, temperature=0.8),
        )
    tokens = result.sequences[0].tokens
    found = re.search(r"<svg.*?</svg>", tokenizer.decode(tokens, skip_special_tokens=True), re.S)
    return {"monster": monster, "tokens": len(tokens), "svg": compact(found.group(0) if found else None)}


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--teacher", default="Qwen/Qwen3.6-35B-A3B")
    parser.add_argument("--n", type=int, default=1200)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    service = tinker.ServiceClient(display_name="monster-telephone-teach")
    client = await service.create_sampling_client_async(base_model=args.teacher)
    tokenizer = client.get_tokenizer()
    limit = asyncio.Semaphore(16)
    rows = await asyncio.gather(*(one(client, tokenizer, monster, limit) for monster in prompts(args.n, 7, False)))
    kept = [row for row in rows if row["svg"]]
    (out / "train.jsonl").write_text("".join(json.dumps(row) + "\n" for row in kept))
    (out / "held_out.json").write_text(json.dumps(prompts(60, 8, True), indent=2))
    used = sum(row["tokens"] for row in rows)
    print("kept", len(kept), "of", len(rows), "tokens generated", used, "mean kept chars", sum(len(r["svg"]) for r in kept) / max(1, len(kept)), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
