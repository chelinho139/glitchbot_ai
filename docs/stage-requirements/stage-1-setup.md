# Stage 1: Project Setup & Dependencies

## Goal

Initialize the GlitchBot project with proper TypeScript configuration, dependencies, and basic project structure.

## Requirements

### 1. Project Initialization

- [ ] Initialize TypeScript project with `package.json`
- [ ] Set up `tsconfig.json` with proper ES2022 settings
- [ ] Create basic directory structure
- [ ] Set up `.gitignore` and `.env.example`

### 2. Dependencies Installation

- [ ] Install `@virtuals-protocol/game` (G.A.M.E engine)
- [ ] Install `@virtuals-protocol/game-twitter-node` (Twitter API client)
- [ ] Install `better-sqlite3` (database)
- [ ] Install `dotenv` (environment variables)
- [ ] Install `pino` and `pino-pretty` (logging)
- [ ] Install `zod` (validation)
- [ ] Install dev dependencies: `typescript`, `tsx`, `@types/node`, `@types/better-sqlite3`

### 3. Project Structure

```
/src
  /agents/glitchbot/
    index.ts
    workers.twitter.ts
    prompts.ts
  /lib/
    db.ts
    ranking.ts
    cadence.ts
    log.ts
  /config/
    environment.ts
/docs/
  stage-requirements/
    stage-1-setup.md
    stage-2-twitter-auth.md
    stage-3-timeline-fetch.md
    stage-4-database.md
    stage-5-quote-tweets.md
    stage-6-replies.md
    stage-7-integration.md
```

### 4. Configuration Files

- [ ] Create `package.json` with proper scripts
- [ ] Create `tsconfig.json` with ES2022 target
- [ ] Create `.env.example` with all required variables
- [ ] Create basic `README.md`

### 5. NPM Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "start": "tsx src/agents/glitchbot/index.ts",
    "dev": "tsx src/agents/glitchbot/index.ts",
    "test": "vitest",
    "test-twitter": "tsx src/test-twitter.ts",
    "clean": "rm -rf dist"
  }
}
```

## Testing Criteria

### ✅ Success Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles TypeScript without errors
- [ ] All dependencies are properly installed
- [ ] Project structure matches requirements
- [ ] TypeScript configuration is correct

### 🧪 Test Commands

```bash
# Test installation
npm install

# Test build
npm run build

# Test TypeScript compilation
npx tsc --noEmit

# Test project structure
ls -la src/
ls -la docs/stage-requirements/
```

## Deliverables

- ✅ `package.json` with all dependencies
- ✅ `tsconfig.json` with proper configuration
- ✅ `.env.example` with all variables
- ✅ Basic project structure
- ✅ All npm scripts working
- ✅ TypeScript compilation successful

## Notes

- Use Node.js 20+ for compatibility
- Ensure all dependencies are the latest stable versions
- Set up proper TypeScript strict mode
- Prepare for ES modules (type: "module")

## Next Stage

After completing Stage 1, proceed to [Stage 2: Twitter Authentication](stage-2-twitter-auth.md)
