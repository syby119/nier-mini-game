# NieR: Automata | The [E] nding game

# [Live Demo](https://nier-mini-game.vercel.app)

This project was born when I was learning React Three Fiber.

---

![License](https://img.shields.io/badge/license-MIT-green)  
[![React Three Fiber](https://img.shields.io/badge/React%20Three%20Fiber-%20?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@react-three/fiber)  
[![React Three Rapier](https://img.shields.io/badge/React%20Three%20Rapier-%20?style=flat&colorA=000000&colorB=000000)](https://github.com/pmndrs/react-three-rapier)  
[![Next.js](https://img.shields.io/badge/Next.js-%20?style=flat&colorA=000000&colorB=000000)](https://nextjs.org/)

---

## Overview

This project is inspired by the **E-Ending of Nier Automata** and was created during my journey of learning **React Three Fiber**. Built with **Next.js**, the game logic is powered by **React Three Rapier**, and post-processing effects like **SSAO** are used to simulate the game's visual style.  

The project makes extensive use of ChatGPT to generate particle effects and some logic processing.

---

## Development

Install dependencies with `pnpm install` and run `pnpm dev`. The game opens at [localhost:3000/zh-hk](http://localhost:3000/zh-hk).

| Path under `src/` | Responsibility |
| --- | --- |
| `app/`, `pages/api/` | Next.js pages, locale routing and HTTP endpoints |
| `game/` | Canvas and overlay composition, shared game state and battle session lifecycle |
| `features/cover/`, `features/opening/`, `features/rescue/`, `features/ending/` | Title menu, opening credits, retry and rescue, results and save donation |
| `features/combat/` | Player and support formation, enemies and credit waves, projectiles and hit effects |
| `features/saves/`, `features/community/` | Browser profiles and run history, pending donations and community data |
| `features/audio/` | Music cues and loops, sound effects and Pod dialogue mixing |
| `features/developer/` | Stage picker, stage URLs and debug controls |
| `shared/` | Reusable UI, gamepad input and Three.js helpers |
| `server/` | Score and donation persistence for the HTTP handlers |

Run `pnpm format` to format the source, styles and configuration. Use `pnpm format:check`, `pnpm typecheck` and `pnpm build` to verify changes.

## Developer stage selection

Run `pnpm dev` and press **F2** or click **選關** to choose a stage by ID and credit name. Each jump starts a fresh run at that checkpoint. You can also open or bookmark a stage URL.

- [Concept art, stage 10_1](http://localhost:3000/zh-hk?stage=10_1)
- [Final battle with the support formation](http://localhost:3000/zh-hk?stage=final&support=1)
- [Results screen](http://localhost:3000/zh-hk?stage=end)

## Preview
![Demo](/git_image/demo.png)
![Demo1](/git_image/demo1.png)
![Demo2](/git_image/demo2.png)
![Demo3](/git_image/demo3.png)
![Demo4](/git_image/demo4.png)

## Acknowledgements

This project uses sound effects from [Mugen87's Nier repository](https://github.com/Mugen87/nier) and references several examples from **React Three Fiber/Drei**. Special thanks to **Mugen87** and **Wawa Sensei** for their inspiring code examples.  

Feel free to contribute! 🚀