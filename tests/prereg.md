# Decisive tests, fixed before any result (2026-10-31)

Sample seed 20261031. Scripts: tests/make_samples.py, run_listener.py.

## Test A: listener on competent drawings (proxy for a player)
18 teacher drawings: 3 per held-out creature, distinct prompts where possible. Each goes through the live POST /api/whisper 3 times. 54 calls.

## Test C: listener on the owner's real page drawings
6 drawings, one per creature, each 3 times through the same endpoint. 18 calls.

Scoring for A and C, by word match on the guess, case-insensitive:
moth: moth, butterfly | goat: goat, ram, sheep | lantern: lantern, lamp | witch: witch, wizard, sorceress | crab: crab, lobster | radio: radio, stereo, speaker
Own rate = guesses matching the drawing's creature. Control rate = mean match rate against the other five lists.
PASS: own >= 30% and own >= 3 x control. PARTIAL: own >= 10% and own >= 2 x control. Otherwise FAIL.

## Test B: blind six-way identification by the owner
5 valid drawings per creature per model (base has 4 lanterns): 89 in random order. Page shows no model, prompt or creature. Choices: six creatures or "can't tell" (counts as wrong). Chance is 1/6. Key stays local until all answers are saved.
r = correct / shown, per model.
Issue 1 CONFIRMED: r_teacher - r_student >= 0.20 and r_student < 0.40.
Issue 1 REFUTED: r_student >= r_teacher - 0.10 and r_student >= 0.40.
Otherwise INCONCLUSIVE, and the post reports the measured rates only.

## Vision retest, fixed before any vision result (2026-10-31, after tests A, B and C)
Same 18 teacher drawings (A') and the owner's 6 drawings at full detail (C'), 3 guesses each. 72 samples on Qwen3.5-4B, plus at most 3 setup probes that do not count.
Image: 448 x 448 PNG, white ground, black lines 6 px wide. Prompt: "Here is a line drawing. You can only guess what it shows. In at most eight words, describe the creature and what is odd about it." 24 tokens, temperature 0.8.
Scoring, word lists and PASS / PARTIAL / FAIL are unchanged, judged separately for A' and C'.
