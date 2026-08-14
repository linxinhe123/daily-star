# Player Portrait and National Team Assets Implementation Plan

> **For agentic workers:** Execute inline; the user explicitly requested results without TDD.

**Goal:** Replace inconsistent fallback headshots with verified TheSportsDB cutouts and replace emoji nationality marks with locally cached national-team badges.

**Architecture:** Extend the existing identity synchronization pipeline with verified portrait overrides and add a dedicated national-team asset synchronization script. Expose a small lookup module to both archive card surfaces.

**Tech Stack:** Node.js scripts, TheSportsDB API, Vue 3, TypeScript, CSS.

## Global Constraints

- TheSportsDB remains the visual asset source.
- Transfermarkt ID and birth date remain the identity authority.
- Assets must be local and work without third-party runtime requests.
- The existing game and profile data behavior must not change.

### Task 1: Normalize Player Portraits

**Files:**
- Modify: `scripts/sync-transfermarkt-identities.mjs`
- Modify: `data/player-identities.json`
- Modify: `apps/web/src/generated/player-identities.json`
- Add/replace: `apps/web/public/assets/players/*.png`

- Add verified TheSportsDB cutout mappings for the affected identities.
- Download the transparent PNG cutouts and update image source metadata.
- Remove superseded square JPG headshots and known wrong same-name PNGs.

### Task 2: Add National Team Assets

**Files:**
- Create: `scripts/sync-national-team-assets.mjs`
- Create: `apps/web/src/generated/national-team-assets.json`
- Create: `apps/web/public/assets/nations/*.png`
- Modify: `package.json`

- Derive unique nationalities from generated identities.
- Resolve exact FIFA World Cup soccer teams from TheSportsDB.
- Download badges locally and write a Chinese-name keyed manifest.

### Task 3: Render and Verify

**Files:**
- Create: `apps/web/src/national-team-assets.ts`
- Modify: `apps/web/src/App.vue`
- Modify: `apps/web/src/styles.css`

- Replace emoji nationality text with badge plus Chinese name in archive and saved cards.
- Run `pnpm audit:player-identities` and `pnpm --filter @daily-star/web build`.
- Check desktop and mobile archive views for image consistency, missing assets, and horizontal overflow.
