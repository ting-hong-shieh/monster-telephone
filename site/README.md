# Monster Telephone

Serve the static page from the repository root:

```sh
python3 -m http.server 4173 --directory site
```

Open `http://localhost:4173`. No build step is needed.

Watch plays an intact chain from `data/chains.json` in at most 15 seconds.
That file contains eight recordings: the trained small model draws, and the
base small model guesses. The home drawing comes from the same file. Recorded
words and SVG source are retained unchanged in replay and export data.

Try saving a monster starts a live round. A suggestion is selected; typing is
optional. Pip draws, Dot guesses, the player rescues the original whisper, Moth
guesses, Hush draws, and Wisp guesses the ending. Each completed drawing and
intermediate guess waits for the player to pass it on. A tap on an animating
paper completes its strokes. Undo removes a stroke. Done is enabled after one
stroke. The gentle 30 second reminder never submits a drawing. Let a ghost draw
uses the original whisper for the rescue.

The same-origin backend is not included:

```text
POST /api/draw     {"whisper":"…"} → {"svg":"…"}
POST /api/whisper  {"svg":"…"}     → {"text":"…"}
```

The 12 second deadline includes reading the response body. Failed calls stop
the round. Retry repeats the failed turn; Watch a recorded chain starts a
separate recording. Player chains never receive recorded substitute turns.
Ghosts only read drawing shape data. SVG rendering keeps direct path children
and their `d` attributes; scripts, nested content, and event handlers are dropped.

The ending compares the original and final whisper, then offers a replayable,
scrubbable flipbook. The page retains its chain in browser session storage when
available, so its local replay address survives reloads in that session.
Save this chain downloads a single PNG containing the original, a drawing and
its guess, and the ending. The rescue pair is selected initially; the selector
can choose either other pair. This file works without the game open.

Link storage is opt-in with `?storage=live`. The link button is hidden until
`GET /api/chains/status` returns `{"live":true}`. All chain link operations live
behind `saveChain` and `loadChain` in `engine.js`:

```text
POST /api/chains        <version 2 chain> → {"id":"<12 lowercase hex characters>"}
GET  /api/chains/<id>                    → <version 2 chain>
```

`?mode=recorded` routes the start form into Watch for testing. There is no public
mode selector. Friend relay has no public interface or link promise. A future
relay can use “Draw what this whisper describes.” with the original hidden.

`motion.js` owns the shared animation clock, anticipation, volume-preserving
poses, trailing sheet edges, curved page turns, pen hesitations, seeded 12 fps
line boil, breathing, gaze, curtains, footlights, and stillness before the rescue
reaction. Normal stroke-on lasts four seconds; the 15 second recording uses
shorter action poses and drawings of about three seconds on an absolute
14 second timeline. Reduced motion removes ambient
motion and holds the reveal until the player starts the flipbook.

Sound is off by default and starts after a gesture. Optional audio files and cue
names are described in [data/audio/README.md](data/audio/README.md).

Run the browser checks with the requested local Playwright installation:

```sh
node site/checks/verify.cjs
```

The runner starts its own server on port 4173 and saves reports and screenshots
in `checks/`. Live inference and storage checks use mocked HTTP responses;
these do not verify a deployed backend.
