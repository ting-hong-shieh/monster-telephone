"""Ask Qwen3.5-4B to guess drawings from pixels, using the rules in prereg.md."""
import asyncio, glob, io, json, re, sys

import tinker
from PIL import Image, ImageDraw
from svgpathtools import parse_path

ASK = "Here is a line drawing. You can only guess what it shows. In at most eight words, describe the creature and what is odd about it."
WORDS = {
    "moth": ["moth", "butterfly"], "goat": ["goat", "ram", "sheep"], "lantern": ["lantern", "lamp"],
    "witch": ["witch", "wizard", "sorceress"], "crab": ["crab", "lobster"], "radio": ["radio", "stereo", "speaker"],
}


def png(svg, size=448, name=None):
    scale = size / 256
    image = Image.new("RGB", (size, size), "white")
    pen = ImageDraw.Draw(image)
    for d in re.findall(r'd="([^"]+)"', svg):
        for line in parse_path(d).continuous_subpaths():
            points = [(line.point(t / max(1, 8 * len(line))).real * scale, line.point(t / max(1, 8 * len(line))).imag * scale) for t in range(8 * len(line) + 1)]
            pen.line(points, fill="black", width=6, joint="curve")
    if name:
        image.save(name)
    out = io.BytesIO()
    image.save(out, "PNG")
    return out.getvalue()


def hit(text, creature):
    return any(re.search(rf"\b{w}s?\b", text.lower()) for w in WORDS[creature])


def score(rows):
    own = sum(r["own"] for r in rows) / len(rows)
    other = sum(r["other"] for r in rows) / len(rows)
    verdict = "PASS" if own >= .3 and own >= 3 * other else "PARTIAL" if own >= .1 and own >= 2 * other else "FAIL"
    return f"own {sum(r['own'] for r in rows)}/{len(rows)} = {own:.3f}  control {other:.3f}  {verdict}"


async def main(mode):
    service = tinker.ServiceClient(display_name="monster-telephone-vision")
    client = await service.create_sampling_client_async(base_model="Qwen/Qwen3.5-4B")
    tokenizer = client.get_tokenizer()
    text = tokenizer.apply_chat_template(
        [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": ASK}]}],
        tokenize=False, add_generation_prompt=True, enable_thinking=False,
    )
    before, after = text.split("<|image_pad|>")
    head, tail = tokenizer.encode(before, add_special_tokens=False), tokenizer.encode(after, add_special_tokens=False)

    async def guess(data):
        prompt = tinker.ModelInput(chunks=[
            tinker.EncodedTextChunk(tokens=head), tinker.types.ImageChunk(data=data, format="png"), tinker.EncodedTextChunk(tokens=tail),
        ])
        result = await client.sample_async(prompt=prompt, num_samples=1, sampling_params=tinker.SamplingParams(max_tokens=24, temperature=0.8))
        return tokenizer.decode(result.sequences[0].tokens, skip_special_tokens=True).strip()

    owner = []
    for path in sorted(glob.glob("tests/answers/drawings/*.json")):
        d = json.load(open(path))
        owner.append({"creature": path.split("/")[-1][:-5], "svg": d.get("data", d)["svg"]})
    if mode == "probe":
        print(repr(text[-160:]))
        print("OWNER", owner[1]["creature"], "|", await guess(png(owner[1]["svg"], name="tests/probe.png")))
        return
    for label, rows, out in (("A'", json.load(open("tests/test_a.json")), "test_a_vision.json"), ("C'", owner, "test_c_vision.json")):
        results = []
        for row in rows:
            data = png(row["svg"])
            for _ in range(3):
                said = await guess(data)
                others = [c for c in WORDS if c != row["creature"]]
                results.append({"creature": row["creature"], "guess": said, "own": hit(said, row["creature"]), "other": sum(hit(said, c) for c in others) / 5})
                print(label, row["creature"], "|", said, flush=True)
        json.dump(results, open(f"tests/{out}", "w"), indent=0)
        print(label, score(results), flush=True)


asyncio.run(main(sys.argv[1]))
