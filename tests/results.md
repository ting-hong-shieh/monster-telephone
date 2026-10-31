# Test results, 2026-10-31 (rules in prereg.md)

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
