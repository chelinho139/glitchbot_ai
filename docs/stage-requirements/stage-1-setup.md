# Stage 1 – Setup

- Use Node 20+ and TypeScript.
- Install packages:
  ```bash
  pnpm add @virtuals-protocol/game @virtuals-protocol/game-twitter-node dotenv
  pnpm add -D typescript ts-node @types/node
  ```
- Create `.env` with `VIRTUALS_API_KEY` and either `GAME_TWITTER_TOKEN` or native app keys (see Stage 2).
- Initialize TS config: `npx tsc --init`.
- Add basic scripts:
  ```json
  {
    "scripts": {
      "dev": "ts-node src/index.ts",
      "build": "tsc",
      "start": "node dist/index.js"
    }
  }
  ```
