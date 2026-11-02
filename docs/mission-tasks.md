# New objective types and flight feedback

The 12 original time trials and their record keys are preserved. Three additional missions offer three difficulty settings each:

- **Pět tváří Brna**: ordered landmark discovery. Continuous slow flight within a visible spherical volume counts toward observation time; leaving, flying too fast, or landing resets it. There is no time competition.
- **Hladké přistání**: four approach gates followed by a touchdown in an oriented runway rectangle. Crossing the end point in the air, taxiing into the box, or landing before the approach is complete cannot finish the mission. Scoring considers touchdown distance from the centre, lateral accuracy, heading, and descent rate before ground contact. Existing aircraft-specific landing conditions still apply.
- **Nízká hlídka Colorada**: sequential checkpoints plus a scored height band and horizontal corridor. The score is the percentage of flight time inside both constraints after crossing the start. Missing map heights count as unverified, never as successful flight. Paused simulation time never advances observation or scoring.

Geometry is sampled from the same 3D map as existing missions. Landing targets sample ground rather than applying circular gate clearance. All task geometry is excluded from terrain collision samples. Actual coverage, height accuracy and flat-ground detection still depend on available Google/Cesium map detail.

Current release progression: **Hladké přistání → Pět tváří Brna → Nad moravskými hrady**. Finishing a mission on any difficulty unlocks the next Brno mission, with progress saved in browser storage. An existing successful landing score also counts. All other missions remain listed but locked for now; their route data and tests are preserved.

Runway 09 threshold and true bearing are from [Czech AIP, LKTB AD 2.12](https://aim.rlp.cz/ais_data/aip/data/valid/a2-tb-text.pdf): 49°09′10.33″N, 16°40′33.11″E, 098° true. Target dimensions, approach heights and scoring are game design values, not real-world operating guidance. The existing Brno panorama is used as the mission location image.

Gate confirmation and stall warning sounds are short synthesized sine tones mixed into the existing audio master. M mutes all audio; pause/end silence cues. No additional audio downloads or licensing are required.

Camera vibration is a small deterministic angular offset above 68% of each aircraft's maximum speed. It never modifies physics or aircraft pose, and is disabled on the ground, when paused or during photography. A persistent checkbox in the pause panel disables motion. The first-run default respects reduced-motion preferences. Low speed and stall warnings use each aircraft's speed threshold with a capped bank-load adjustment; this remains assisted game physics.

Verification: original regression tests, nine task variants, terrain preparation, complete discovery/landing/low-flight flows, invalid touchdown rejection, pause/reset behaviour, score constraints, menu rendering, camera effect limits, mute/pause and finite sound envelopes. Real Google terrain and WebGL visuals require live flight validation.


## Runway scenario variety (2 November 2026)

The runway catalogue now separates gameplay as well as conditions: a short introductory final, a full circuit with a mandatory stop before the marked runway limit, an offset crosswind arrival, a scripted occupied-runway missed approach, an actual touch-and-go followed by a second landing, and an engine-out glide with zero available power. The occupied runway is a briefing constraint, without simulated traffic. The touch-and-go score averages both touchdowns. Landing before the assigned zone fails the attempt; flying through a touch-and-go zone or taxiing through a departure gate cannot advance it.

Menu goals, map actions, in-flight instructions, radio lines and result feedback describe these tasks. Changed landing route records use v2 IDs; existing career medals remain. All 167 tests and syntax checks pass. The emergency trainer glide also completes with the actual flight and ground-contact model. Browser verification covered the mission menu and mobile-width task presentation; a complete manual flight over live Google terrain remains unverified.
