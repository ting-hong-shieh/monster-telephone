# Test results, 2026-10-31 (rules in prereg.md)

## Added after the blind test, 2026-11-01 (not in prereg.md)

`recognition_check.py`, output in `recognition_check.json`. Direction only: both checks were chosen after seeing the blind result.

| Model | Drawings | Closest other prompt shows the same creature | Chance | p |
| --- | --- | --- | --- | --- |
| Base | 54 | 25.9% | 18.4% | 0.146 |
| Fine-tuned, first run | 117 | 17.9% | 17.5% | 0.489 |
| Fine-tuned, artist-2 | 118 | 22.0% | 17.4% | 0.137 |
| Teacher | 92 | 27.2% | 16.8% | 0.022 |

Pixel similarity after a blur, not recognition. The p value shuffles creature labels across prompts 2,000 times.

Recorded chains, word match on the starting monster with close synonyms: 0 of 24 guesses in the eight rounds with a ghost in the player's seat, 1 of 3 in the one round with a real drawing. Each chain was recorded once.

Wilson 95% intervals in the post's validity chart: base 36.4–53.9%, fine-tuned 92.9–99.1%, teacher 68.3–83.3%. They treat the two samples per prompt as independent, so they are slightly narrow.

| Test | Result | Verdict |
| --- | --- | --- |
| A: live listener on teacher drawings | 0/54, control 0.004 | FAIL |
| C: live listener on the owner's 6 drawings | 0/18, control 0 | FAIL |
| B: blind six-way, owner | base 1/29, student 2/30, teacher 7/30; 66/89 "can't tell" | INCONCLUSIVE (gap 0.167, rule needs 0.20) |

Wilson 95%: base 0.6–17.2%, student 1.8–21.3%, teacher 11.8–40.9%. Chance is 16.7%.
4 of the owner's 6 drawings (6,722–13,222 chars) got 422 from the 6,000-char server limit. They were thinned to fit for test C, keeping every 2nd or 3rd point.
Render cold start: 62.7 s on /api/health.
Test C is one rater's six drawings; test B is one rater, who drew the page's creatures in the same sitting after rating.

## Vision retest (Qwen3.5-4B reading a 448 px PNG)

| Test | Text listener | Vision listener | Vision verdict |
| --- | --- | --- | --- |
| Teacher drawings | 0/54 | 0/54, control 0 | FAIL |
| Owner's 6 drawings | 0/18 | 4/18, control 0 | PARTIAL |

Hits: crab 3/3 ("A crab with arms giving a thumbs up."), moth 1/3 ("A butterfly with a distinctly jagged, uneven wing shape."). Near misses the fixed word list does not count: "a lightbulb head" for the lantern, a hat twice for the witch, horns for the goat, a square head or body twice for the radio.
Unit of evidence is six drawings by one person, and one crab gives three of the four hits. Treat it as direction, not a rate. Full guesses are in vision.log.
