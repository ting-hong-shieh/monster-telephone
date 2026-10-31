# Monster Telephone

Telephone with monsters. You whisper a monster to a table of AI ghosts. One draws it, the next guesses from the drawing alone, and the story drifts. You are the only one who remembers the original, so at your turn you try to draw it back.

Play at [monstertelephone.tech](https://monstertelephone.tech).

## How it works

The ghosts run on open-weight models through [Tinker](https://tinker-docs.thinkingmachines.ai/):

| Role | Model | Sees |
| --- | --- | --- |
| Artist | Qwen3.5-4B, fine-tuned | The whisper only |
| Listener | Qwen3.5-4B | The drawing as a picture, not the whisper |

## The fine-tune

Qwen3.5-4B alone often fails to finish a clean line drawing. Qwen3.6-35B draws well but is larger. `teach.py` had the larger model draw 1,200 monsters and kept the 955 that passed a strict check. `learn.py` fine-tuned the small model on them with a rank 64 LoRA for 3 epochs.

Evaluation used 60 prompts about six creatures absent from training, sampled twice each:

| Model | Valid drawings | Mean tokens | Mean seconds |
| --- | --- | --- | --- |
| Qwen3.5-4B | 54 / 120 | 765 | 4.25 |
| Qwen3.5-4B, fine-tuned | 117 / 120 | 591 | 4.02 |
| Qwen3.6-35B | 92 / 120 | 830 | 5.38 |

Valid means the output parses, holds 3 to 14 unfilled paths, and stays within the canvas. It does not mean the drawing looks like the prompt, which this evaluation does not measure. The seconds come from batched sampling and are rough.

The training set, held-out prompts, results and recorded chains are in `data/`.

## Run it

Set `TINKER_API_KEY`, then:

```bash
uv run --no-project --with tinker --with transformers --with jinja2 python teach.py --out out/teach
uv run --no-project --with tinker --with transformers --with jinja2 python learn.py --data out/teach --rank 64 --out out/artist
```

The server in `server/` needs `ARTIST_PATH`, the sampler path saved by `learn.py`. The page in `site/` is static.

## License

Apache-2.0.
