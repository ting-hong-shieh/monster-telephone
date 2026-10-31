"""Compare how open models draw monsters as line SVGs before any fine-tuning."""

from __future__ import annotations

import argparse
import asyncio
import json
import re
from pathlib import Path

import tinker

MONSTERS = [
    "a bat with too many teeth",
    "a spider that is afraid of its own legs",
    "a ghost wearing a tiny crown",
    "a three-eyed cat on a broken chair",
    "a skeleton hand holding a telephone",
    "a jellyfish with human feet",
]
BRIEF = (
    "Draw {monster} as a simple black line drawing. Reply with only one SVG: viewBox 0 0 256 256, "
    "at most 14 <path> elements, each with fill=\"none\" stroke=\"black\" stroke-width=\"3\". No text, no comments."
)


def encode(tokenizer, user: str) -> list[int]:
    messages = [{"role": "user", "content": user}]
    try:
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    except TypeError:
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    return tokenizer.encode(text, add_special_tokens=False)


async def draw(client, tokenizer, monster: str, samples: int, limit: asyncio.Semaphore) -> list[dict]:
    params = tinker.SamplingParams(max_tokens=1100, temperature=0.8)
    async with limit:
        result = await client.sample_async(
            prompt=tinker.ModelInput.from_ints(encode(tokenizer, BRIEF.format(monster=monster))),
            num_samples=samples,
            sampling_params=params,
        )
    rows = []
    for sequence in result.sequences:
        reply = tokenizer.decode(sequence.tokens, skip_special_tokens=True)
        found = re.search(r"<svg.*?</svg>", reply, re.S)
        rows.append({"monster": monster, "tokens": len(sequence.tokens), "svg": found.group(0) if found else None, "reply": reply})
    return rows


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", nargs="+", required=True)
    parser.add_argument("--samples", type=int, default=2)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    service = tinker.ServiceClient(display_name="monster-telephone-probe")
    capabilities = await service.get_server_capabilities_async()
    available = [item.model_name for item in capabilities.supported_models]
    print("models", available, flush=True)
    results = {}
    for model in args.models:
        if model not in available:
            print("missing", model, flush=True)
            continue
        client = await service.create_sampling_client_async(base_model=model)
        tokenizer = client.get_tokenizer()
        limit = asyncio.Semaphore(6)
        groups = await asyncio.gather(*(draw(client, tokenizer, monster, args.samples, limit) for monster in MONSTERS))
        results[model] = [row for group in groups for row in group]
        drawn = sum(1 for row in results[model] if row["svg"])
        print(model, "svg", drawn, "of", len(results[model]), "mean tokens", sum(r["tokens"] for r in results[model]) / len(results[model]), flush=True)
        (out / "probe.json").write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
