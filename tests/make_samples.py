"""Draw the fixed samples for tests A and B. The key stays in this folder."""
import collections, json, random, secrets

SEED = 20261031
CREATURES = ["moth", "goat", "lantern", "witch", "crab", "radio"]
drawings = json.load(open("data/results.json"))["drawings"]


def pick(rows, each, rng):
    groups = collections.defaultdict(lambda: collections.defaultdict(list))
    for row in rows:
        if row["svg"]:
            groups[row["monster"].split()[1]][row["monster"]].append(row)
    chosen = []
    for creature in CREATURES:
        prompts = list(groups[creature].values())
        rng.shuffle(prompts)
        taken = []
        round_ = 0
        while len(taken) < each and any(len(p) > round_ for p in prompts):
            taken += [p[round_] for p in prompts if len(p) > round_]
            round_ += 1
        chosen += [dict(row, creature=creature) for row in taken[:each]]
    return chosen


rng = random.Random(SEED)
test_a = pick(drawings["teacher"], 3, rng)
json.dump(test_a, open("tests/test_a.json", "w"))

items = []
for model in ["base", "student", "teacher"]:
    for row in pick(drawings[model], 5, rng):
        items.append({"id": secrets.token_hex(4), "model": model, "creature": row["creature"], "monster": row["monster"], "svg": row["svg"]})
rng.shuffle(items)
json.dump(items, open("tests/test_b_key.json", "w"))
json.dump([{"id": i["id"], "svg": i["svg"]} for i in items], open("tests/test_b_items.json", "w"))
print(len(test_a), len(items), collections.Counter(i["model"] for i in items))
