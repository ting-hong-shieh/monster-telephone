"""Check whether a model can name a drawing from its SVG text alone."""

import asyncio
import json

import tinker

from probe import encode

ASK = "Here is a line drawing as SVG:\n{svg}\nYou can only guess what it shows. In at most eight words, describe the creature and what is odd about it."


async def main() -> None:
    print("image chunk", hasattr(tinker, "ImageChunk") or hasattr(tinker.types, "ImageChunk"))
    rows = json.load(open("site/data/fixture.json"))["drawings"][::4]
    service = tinker.ServiceClient(display_name="monster-telephone-whisper")
    for model in ["Qwen/Qwen3.5-4B", "Qwen/Qwen3.6-35B-A3B"]:
        client = await service.create_sampling_client_async(base_model=model)
        tokenizer = client.get_tokenizer()
        for row in rows:
            result = await client.sample_async(
                prompt=tinker.ModelInput.from_ints(encode(tokenizer, ASK.format(svg=row["svg"]))),
                num_samples=2,
                sampling_params=tinker.SamplingParams(max_tokens=24, temperature=0.8),
            )
            print(model.split("/")[1][:8], "|", row["monster"], "=>", [tokenizer.decode(s.tokens, skip_special_tokens=True) for s in result.sequences], flush=True)


asyncio.run(main())
