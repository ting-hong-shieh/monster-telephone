"""Play telephone: draw a whisper, guess the drawing, and repeat."""

from __future__ import annotations

import argparse
import asyncio
import json
import re
from pathlib import Path

import tinker

from probe import BRIEF, encode
from teach import compact

ASK = "Here is a line drawing as SVG:\n{svg}\nYou can only guess what it shows. In at most eight words, describe the creature and what is odd about it."
STARTS = [
    "a bat with too many teeth",
    "a ghost wearing a tiny crown",
    "a teapot with human feet",
    "a skeleton holding a telephone",
    "a cat with a second head",
    "an owl afraid of its own shadow",
    "a pumpkin eating a sock",
    "a very polite vampire",
]


async def draw(client, tokenizer, whisper: str) -> str | None:
    for _ in range(3):
        result = await client.sample_async(
            prompt=tinker.ModelInput.from_ints(encode(tokenizer, BRIEF.format(monster=whisper))),
            num_samples=1,
            sampling_params=tinker.SamplingParams(max_tokens=1100, temperature=0.8),
        )
        found = re.search(r"<svg.*?</svg>", tokenizer.decode(result.sequences[0].tokens, skip_special_tokens=True), re.S)
        svg = compact(found.group(0) if found else None)
        if svg:
            return svg
    return None


async def guess(client, tokenizer, svg: str) -> str:
    result = await client.sample_async(
        prompt=tinker.ModelInput.from_ints(encode(tokenizer, ASK.format(svg=svg))),
        num_samples=1,
        sampling_params=tinker.SamplingParams(max_tokens=24, temperature=0.8),
    )
    return tokenizer.decode(result.sequences[0].tokens, skip_special_tokens=True).strip()


async def play(client, listener, tokenizer, start: str, turns: int) -> dict:
    steps = [{"kind": "whisper", "text": start}]
    whisper = start
    for _ in range(turns):
        svg = await draw(client, tokenizer, whisper)
        if not svg:
            break
        steps.append({"kind": "drawing", "svg": svg})
        whisper = await guess(listener, tokenizer, svg)
        steps.append({"kind": "whisper", "text": whisper})
    return {"start": start, "steps": steps}


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artist", default="Qwen/Qwen3.6-35B-A3B")
    parser.add_argument("--listener", default="Qwen/Qwen3.5-4B")
    parser.add_argument("--turns", type=int, default=3)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    service = tinker.ServiceClient(display_name="monster-telephone-chain")
    listener = await service.create_sampling_client_async(base_model=args.listener)
    tokenizer = listener.get_tokenizer()
    if args.artist.startswith("tinker://"):
        client = await service.create_sampling_client_async(model_path=args.artist)
    else:
        client = await service.create_sampling_client_async(base_model=args.artist)
    chains = await asyncio.gather(*(play(client, listener, tokenizer, start, args.turns) for start in STARTS))
    Path(args.out).write_text(json.dumps({"artist": args.artist, "listener": args.listener, "chains": chains}, indent=2))
    for chain in chains:
        print(" -> ".join(step["text"] for step in chain["steps"] if step["kind"] == "whisper"), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
