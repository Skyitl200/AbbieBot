# Treasure Crates

Each correct `/test` answer and successful Microbemon catch independently has a
**1-in-300** chance to award a Treasure Crate. Incorrect answers and failed
catches do not roll. Existing Sponsor catch limits still apply.

The activity result announces a saved crate. `/inventory` displays owned crates,
provides an **Open Treasure Crate** button, and lists **Possible Crate Rewards**.
Opening consumes one crate and grants one reward:

| Reward | Rarity | Chance per opening |
| --- | --- | --- |
| 5–30 Merit Coins | Common | 20% |
| Field Researcher Badge | Common | 20% |
| Microscope Pin | Common | 15% |
| DNA Helix Pin | Uncommon | 12% |
| Petri Dish Charm | Uncommon | 10% |
| Anatomy Atlas | Rare | 8% |
| Silver Specimen | Rare | 6% |
| Golden Microbe | Epic | 4% |
| Prismatic Helix | Epic | 3% |
| Guild Relic | Legendary | 2% |

Higher coin amounts are more likely within the 5–30 range, using the same
weighted distribution as activity rewards. Coin openings show the new balance.
Other rewards are permanent cosmetic inventory collectibles; duplicates stack.
They do not grant server roles, battle bonuses, or Microbemon pets.

Drops persist atomically with the activity reward. Openings persist cache
consumption, loot, and a retry receipt together. Owner-only opening buttons
expire after one hour; use `/inventory` again for fresh controls. Repeated
clicks on the same button return its saved reward without consuming another
cache. Persistent database failures leave the transaction uncommitted.

Validation: `npm run test:discovery`, `npm run test:study`, and
`npm run test:microbemon`.

Drop notifications in /test and Microbemon include the original user-supplied
animated chest GIF inline, alongside existing activity images.
