"""Live ghosts for Monster Telephone: draw a whisper and whisper about a drawing."""

from __future__ import annotations

import os
import re
import time
import xml.etree.ElementTree as ET
from collections import defaultdict, deque

import tinker
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE = "Qwen/Qwen3.5-4B"
ARTIST = os.environ["ARTIST_PATH"]
ORIGINS = os.environ.get("ALLOWED_ORIGINS", "https://monstertelephone.tech").split(",")
TOKEN_LIMIT = int(os.environ.get("DAILY_TOKEN_LIMIT", "2000000"))
PER_MINUTE = int(os.environ.get("REQUESTS_PER_MINUTE", "30"))
BRIEF = (
    "Draw {monster} as a simple black line drawing. Reply with only one SVG: viewBox 0 0 256 256, "
    "at most 14 <path> elements, each with fill=\"none\" stroke=\"black\" stroke-width=\"3\". No text, no comments."
)
ASK = "Here is a line drawing as SVG:\n{svg}\nYou can only guess what it shows. In at most eight words, describe the creature and what is odd about it."
PATH_DATA = re.compile(r"^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s-]+$")

app = FastAPI(title="Monster Telephone")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["POST", "GET"], allow_headers=["content-type"])
ghosts: dict = {}
spent = {"day": "", "tokens": 0}
calls: dict[str, deque] = defaultdict(deque)


class Whisper(BaseModel):
    whisper: str = Field(min_length=1, max_length=140)


class Drawing(BaseModel):
    svg: str = Field(min_length=20, max_length=6000)


def paths(svg: str | None, most: int) -> list[str] | None:
    """Return the path data of a drawing, or None if it holds anything else."""
    if not svg:
        return None
    try:
        root = ET.fromstring(re.sub(r'\sxmlns="[^"]*"', "", svg))
    except ET.ParseError:
        return None
    found = []
    for node in root.iter():
        if node.tag == "path":
            data = re.sub(r"\s+", " ", node.get("d", "")).strip()
            if not PATH_DATA.match(data) or node.get("fill") not in (None, "none"):
                return None
            found.append(data)
        elif node.tag not in ("svg", "g"):
            return None
    return found if 1 <= len(found) <= most else None


def wrap(found: list[str]) -> str:
    body = "".join(f'<path d="{data}"/>' for data in found)
    return f'<svg viewBox="0 0 256 256" fill="none" stroke="black" stroke-width="3">{body}</svg>'


def encode(tokenizer, user: str) -> list[int]:
    text = tokenizer.apply_chat_template(
        [{"role": "user", "content": user}], tokenize=False, add_generation_prompt=True, enable_thinking=False
    )
    return tokenizer.encode(text, add_special_tokens=False)


def guard(request: Request) -> None:
    today = time.strftime("%Y-%m-%d", time.gmtime())
    if spent["day"] != today:
        spent.update(day=today, tokens=0)
    if spent["tokens"] >= TOKEN_LIMIT:
        raise HTTPException(503, "The ghosts are resting today.")
    now = time.time()
    who = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0]
    seen = calls[who]
    while seen and now - seen[0] > 60:
        seen.popleft()
    if len(seen) >= PER_MINUTE:
        raise HTTPException(429, "Too many whispers.")
    seen.append(now)


async def ask(client, user: str, tokens: int, temperature: float) -> str:
    tokenizer = ghosts["tokenizer"]
    prompt = encode(tokenizer, user)
    result = await client.sample_async(
        prompt=tinker.ModelInput.from_ints(prompt),
        num_samples=1,
        sampling_params=tinker.SamplingParams(max_tokens=tokens, temperature=temperature),
    )
    made = result.sequences[0].tokens
    spent["tokens"] += len(prompt) + len(made)
    return tokenizer.decode(made, skip_special_tokens=True)


@app.on_event("startup")
async def wake() -> None:
    service = tinker.ServiceClient(display_name="monster-telephone-live")
    ghosts["listener"] = await service.create_sampling_client_async(base_model=BASE)
    ghosts["artist"] = await service.create_sampling_client_async(model_path=ARTIST)
    ghosts["tokenizer"] = ghosts["listener"].get_tokenizer()


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "tokens_today": spent["tokens"], "limit": TOKEN_LIMIT}


@app.post("/api/draw")
async def draw(item: Whisper, request: Request) -> dict:
    guard(request)
    began = time.perf_counter()
    for _ in range(2):
        reply = await ask(ghosts["artist"], BRIEF.format(monster=item.whisper.strip()), 900, 0.8)
        found = re.search(r"<svg.*?</svg>", reply, re.S)
        drawn = paths(found.group(0) if found else None, 14)
        if drawn and len(drawn) >= 3:
            return {"svg": wrap(drawn), "ms": round((time.perf_counter() - began) * 1000)}
    raise HTTPException(502, "The ghost dropped its pen.")


@app.post("/api/whisper")
async def whisper(item: Drawing, request: Request) -> dict:
    guard(request)
    drawn = paths(item.svg, 80)
    if not drawn:
        raise HTTPException(422, "That is not a drawing the ghosts can read.")
    began = time.perf_counter()
    text = await ask(ghosts["listener"], ASK.format(svg=wrap(drawn)), 24, 0.8)
    return {"text": text.strip(), "ms": round((time.perf_counter() - began) * 1000)}
