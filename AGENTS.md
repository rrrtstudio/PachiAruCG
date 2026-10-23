# PachiAruCG — Codex production rules

## Purpose
Create short, surreal observations of Japanese pachinko / pachislot players. The humor should come from players' habits, frustration, indifference, tiny rivalries and realistic machine states. This is NOT a gambling promotion or a casino commercial.

## Deliverable and technical direction
- Mobile-first: browser preview must work on a smartphone, without a running home PC.
- Default video framing is portrait 9:16, planned at 1080×1920 / 30 fps. Preview may use a lower resolution.
- Begin with a fully animatable, consistent 3D character rig. Use real animation curves / interpolated transforms. Do not fake animation by replacing static screenshots.
- Three.js is the initial web-preview engine. Keep rendering lightweight enough for common Android browsers. Avoid mandatory GPU-expensive postprocessing.
- Build simple, reusable components; separate character rig, machine-state logic, scenes and shot timeline when the prototype grows.
- Keep UI labels outside the exported shot. Video should make sense mostly without narration or captions.

## Visual bible — characters
- Rounded, simple stylized CG: warm peach-colored bald head, no hair, no eyebrows, no nose, facial detail limited to eyes and mouth. Rounded, smooth materials; not photorealism and not anime-style humans.
- Expressions include neutral, smile, surprise, disappointment, anger, anxiety, despair, dry smile, doubt and pretending to be fine.
- Same head/face for bare-eyed and eyeglasses versions. Glasses are a toggleable accessory, not a different character.
- Clothing conveys identity: main adult man (20s–50s), optional wife/girlfriend, friend, gambling companion, older men (2), older women (2), workwear adults (at least 2), store employees as needed.
- Children may appear ONLY outside the store property (such as a public sidewalk) or at home, NEVER inside a pachinko parlor or anywhere within its premises.
- Customers are mostly strangers. Normally they are indifferent to one another. Don't make crowds spontaneously celebrate someone's win. Glances and mild rivalry are fine; explicit friendship must be scripted.
- More important than big facial acting: subtle eyeline shift, delayed head turn, shoulder slump, quiet return to play.

## Machines and IP
- Five fictional standard machines: three slots (traditional normal, tropical notice, smart AT) and two pachinko (simple ST, battle RUSH).
- Never render actual machine/series/manufacturer names, logos, distinctive licensed characters, official songs, specific model-specific designs, or exact copyrighted art. Use original invented designs even when text production notes discuss a reference class.
- Slot reels are three-reel, three-row. Idle positions: abstract colored rectangular symbols NOT forming identical three-in-a-row on any row. Never show a cherry on the left reel's center row. Bonus establishment/notification must remain distinct from entering the bonus by aligning three fictional red 7s across the center row.
- Normal A-type: ordinary reel play -> bonus establishment / notification (mechanism depends on fictional design) -> align bonus -> bonus play -> normal. NO AT-style additions/continuations. BT-type requires a separately defined variant, not silently merged into the traditional normal game.
- Tropical notice type: the main notification lamp must be OFF throughout non-winning normal play; never illuminate it as idle decoration. After qualifying bonus, lamp lights. Avoid claiming exact timing of real-machine features.
- AT type: normal / appropriate prelude or CZ -> entry -> AT play -> optional game additions / continuation -> finish. Each transition must be visually distinguishable but no extra invented rule without deliberate approval.
- Pachinko: usual play -> advance notice (when applicable) -> reach/development -> win or miss -> jackpot rounds -> applicable ST/RUSH/continuation -> exit. Do not show AT-style game additions on unrelated machines.
- Nonwinning screens should stay relatively calm; winning main display may briefly turn gold/rainbow. Don't fill every machine with constant gold lights. No coin boxes for current smart slots.
- A single portrait shot typically frames one primary cabinet with about half of each adjacent cabinet cropped by the sides. Keep machine layout coherent: same island with the same model series.

## World and recurring locations
- A: everyday suburban parlor, attached parking lot, moderate crowd.
- B: busy station-front parlor, connected parking-lot validation for player parking, generally high crowd density.
- C: older quiet small parlor with visible empty chairs and dated fixtures.
- Occupancy varies with time and special event; labels A/B/C describe a typical day, not an immutable percentage.
- Realistic context: entrances, aisles/islands, counting machines, prize counter, rest zone, smoking room, toilets, ATMs when appropriate, workwear customers, etc.
- Use actual contemporary smoking segregation norms; paper cigarettes should not appear lit at ordinary indoor seats of a present-day parlor. Heated-tobacco designated areas must be explicit.
- Outside the cabinets, keep the colors and scenery fairly mundane, somewhat reminiscent of 1990s Japanese daily life; only cabinets are comparatively vibrant.

## Story domain
- The core must be pachinko / pachislot player behavior, not random general visual gags that happen to be set in a store.
- Borrowing / cash scarcity and machine-banging behavior can be referenced as critical or absurd behavior, without actionable guidance for wrongdoing or glorifying violence.
- Do not create actual counterfeit payment / card methods, or other actionable crime.
- No stories where winning another kind of gambling is the solution to pachinko losses; briefly watching another sport on a phone is okay when pachinko remains central.

## Acceptance tests before merging
- Character proportions/colors and recognizable identical face across shots.
- Mobile Android viewport (9:16) fits, no horizontal overflow and works with touch controls.
- Head, arms, blinking and mouth transitions interpolate smoothly; no abrupt model replacement.
- All visible machine cabinets/locations are internally coherent. Non-win and win states distinct.
- Fictional machines only; no real names/logos in generated art.
- No minors anywhere on gambling premises.
- Strangers do not celebrate together unless specified.
