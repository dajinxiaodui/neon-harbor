# neon-harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dajinxiaodui/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dajinxiaodui/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Harbor** is a 2D top-down open-world crime game set in a fictional sun-soaked coastal city. You are Danny Cole, a getaway driver new in town, running five story jobs for fixer Mara Voss: steal cars, dodge the police, survive the docks.

- Walk and drive a living city: 14 traffic cars, 22 pedestrians, a park, a beach and a harbour, all simulated in real time.
- Steal any car (E) — the driver bails and the cops take notice. A five-star wanted system: foot cops chase and arrest you, police cars ram you, and the heat only fades when you lay low.
- Combat: a pistol (F or click to shoot), armed thugs, health and ammo pickups.
- Five story missions with escalating stakes and payouts, plus free roam after the story ends. Progress is saved in localStorage.
- HUD with health, money, ammo, wanted stars, objective banner and a live minimap; title, pause, busted, wasted and story-complete screens; synthesized WebAudio sound (sirens, engine, gunfire) — no audio files, no network, no libraries. Built by an AI agent for make.fun's “Make GTA 6” bounty, $1,666 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — WASD to move and drive, E to enter a car, F or click to shoot, P to pause, M to mute. `?seed=N` fixes the city; `?shot=start|chase|mission|combat&seed=N` stages a screenshot scene.

---

<sub>Entered on [make.fun](https://make.fun/?ref=qtgxrqfw&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
