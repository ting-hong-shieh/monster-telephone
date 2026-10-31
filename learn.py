"""Fine-tune the small model on the teacher's drawings and compare it on held-out monsters."""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import re
import time
from pathlib import Path

import tinker

from probe import BRIEF, encode
from teach import compact

BASE = "Qwen/Qwen3.5-4B"
TEACHER = "Qwen/Qwen3.6-35B-A3B"


def datum(tokenizer, row: dict) -> tinker.Datum:
    prompt = encode(tokenizer, BRIEF.format(monster=row["monster"]))
    answer = tokenizer.encode(row["svg"] + "<|im_end|>", add_special_tokens=False)
    tokens = prompt + answer
    weights = [0.0] * len(prompt) + [1.0] * len(answer)
    return tinker.Datum(
        model_input=tinker.ModelInput.from_ints(tokens[:-1]),
        loss_fn_inputs={"target_tokens": tokens[1:], "weights": weights[1:]},
    )


async def train(service, rows: list[dict], args) -> str:
    trainer = await service.create_lora_training_client_async(base_model=BASE, rank=args.rank)
    tokenizer = trainer.get_tokenizer()
    data = [datum(tokenizer, row) for row in rows]
    print("training tokens per epoch", sum(len(item.model_input.to_ints()) for item in data), flush=True)
    rng = random.Random(11)
    step = 0
    for epoch in range(args.epochs):
        rng.shuffle(data)
        for start in range(0, len(data), args.batch):
            backward = await trainer.forward_backward_async(data[start : start + args.batch], "cross_entropy")
            optimise = await trainer.optim_step_async(tinker.AdamParams(learning_rate=args.lr))
            await backward.result_async()
            await optimise.result_async()
            step += 1
        print("epoch", epoch, "steps", step, flush=True)
    saved = await (await trainer.save_weights_for_sampler_async(name=args.name)).result_async()
    return saved.path


async def examine(client, tokenizer, monsters: list[str], samples: int) -> list[dict]:
    limit = asyncio.Semaphore(8)
    params = tinker.SamplingParams(max_tokens=1100, temperature=0.8)

    async def one(monster: str) -> list[dict]:
        async with limit:
            began = time.perf_counter()
            result = await client.sample_async(
                prompt=tinker.ModelInput.from_ints(encode(tokenizer, BRIEF.format(monster=monster))),
                num_samples=samples,
                sampling_params=params,
            )
            seconds = time.perf_counter() - began
        rows = []
        for sequence in result.sequences:
            found = re.search(r"<svg.*?</svg>", tokenizer.decode(sequence.tokens, skip_special_tokens=True), re.S)
            rows.append({"monster": monster, "tokens": len(sequence.tokens), "seconds": seconds, "svg": compact(found.group(0) if found else None)})
        return rows

    return [row for group in await asyncio.gather(*(one(monster) for monster in monsters)) for row in group]


def summary(rows: list[dict]) -> dict:
    valid = [row for row in rows if row["svg"]]
    return {
        "valid": len(valid),
        "total": len(rows),
        "mean_tokens": sum(row["tokens"] for row in rows) / len(rows),
        "mean_seconds": sum(row["seconds"] for row in rows) / len(rows),
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--rank", type=int, default=32)
    parser.add_argument("--samples", type=int, default=2)
    parser.add_argument("--name", default="artist")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    data = Path(args.data)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    rows = [json.loads(line) for line in (data / "train.jsonl").read_text().splitlines()]
    monsters = json.loads((data / "held_out.json").read_text())

    service = tinker.ServiceClient(display_name="monster-telephone-learn")
    path = await train(service, rows, args)
    base = await service.create_sampling_client_async(base_model=BASE)
    tokenizer = base.get_tokenizer()
    teacher = await service.create_sampling_client_async(base_model=TEACHER)
    student = await service.create_sampling_client_async(model_path=path)

    results = {"path": path, "drawings": {}, "summary": {}}
    for name, client, words in (("base", base, tokenizer), ("student", student, tokenizer), ("teacher", teacher, teacher.get_tokenizer())):
        drawn = await examine(client, words, monsters, args.samples)
        results["drawings"][name] = drawn
        results["summary"][name] = summary(drawn)
        print(name, results["summary"][name], flush=True)
        (out / "results.json").write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
