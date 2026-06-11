# RESINA Project Structure Reference

Last updated: 2026-05-31

This document is the short source of truth for future AI prompts. Read this first, then inspect only the folder that owns the requested change.

## Purpose

RESINA is a monorepo with three product surfaces:

- Web portal for the browser experience and admin flows.
- API service for tide, weather, alert, and background data jobs.
- Mobile app for the Expo/React Native experience.

## Root Layout

- `README.md`: entry point for repo-wide notes and commands.
- `resina-project/`: main application workspace.
- `.github/workflows/`: repository-level automation.
- `scripts/`: one-off utility scripts.
- `TIDE_SETUP.sh`: setup helper for tide-related workflows.

## Ownership Map

### Web

Path: `resina-project/apps/web/`

Use this for browser UI, admin pages, auth screens, and Supabase-connected web logic.

Key files and folders:

- `app/page.tsx`: landing/home page.
- `app/layout.tsx`: shared app shell.
- `app/globals.css`: global web styles.
- `middleware.ts`: request and auth routing rules.
- `lib/`: shared browser-side helpers, Supabase wrappers, weather formatting, and SMS-related utilities.
- `public/`: web assets.
- `sql/`: schema and database scripts.

### API

Path: `resina-project/apps/api/`

Use this for backend data fetches, tide interpolation, weather ingestion, alert dispatch, and realtime listeners.

Key files and folders:

- `src/index.ts`: API entry point.
- `src/realtime-listener.ts`: realtime event listener.
- `src/services/`: service layer for Stormglass, tide, and interpolation logic.
- `src/tide/`: tide fetch, refresh, and interpolation jobs.
- `src/weather/`: weather fetch logic.
- `src/utils/`: shared helpers and date/window utilities.

### Mobile

Path: `resina-project/apps/mobile/`

Use this for the Expo app, React Native UI, offline cache handling, and mobile-specific screens.

Key files and folders:

- `App.tsx`: mobile app entry.
- `components/`: screen sections, cards, modals, toasts, and navigation UI.
- `lib/cache.ts`: cache helpers.
- `lib/offline-write-queue.ts`: offline write queue.
- `lib/supabase.ts`: mobile Supabase client setup.
- `assets/`: images and icons.

## Change Documentation Rule

Every change should be documented in this file so the next AI prompt can work from the summary instead of opening the full tree.

Use the template below for every task. Keep each field short and specific.

## Change Entry Template

```md
### YYYY-MM-DD

- Prompt: <what the user asked for>
- Area: <web | api | mobile | root | multiple>
- Files changed: <comma-separated paths>
- What changed: <short summary of the edit>
- Validation: <command run or "documentation only">
```

Rules for entries:

- Use one entry per task.
- If the task spans multiple ownership areas, list them in one entry only when the change is tightly related. Otherwise add one entry per area.
- Keep the prompt line close to the original user intent.
- Include the actual validation command if code was changed.
- If no command was run, say why.

If a task touches only one area, document only that area. If a task spans multiple areas, add one entry per area or one combined entry with the affected paths.

## Change Log

### 2026-06-11

- Prompt: create role-specific documentation for residents and admins with a shared architecture link.
- Area: root
- Files changed: [resina-project/docs/architecture.md](docs/architecture.md), [resina-project/docs/roles/residents.md](docs/roles/residents.md), [resina-project/docs/roles/admin.md](docs/roles/admin.md), [resina-project/PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
- What changed: added resident and admin Markdown guides, plus a short architecture overview that the role docs link to.
- Validation: documentation only.

### 2026-06-11 (landing)

- Prompt: display sensor, weather, and tide monitoring on public landing page for unauthenticated users.
- Area: web
- Files changed: [resina-project/apps/web/app/page.tsx](resina-project/apps/web/app/page.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicSensorCard.tsx](resina-project/apps/web/app/components/public-monitoring/PublicSensorCard.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicWeatherCard.tsx](resina-project/apps/web/app/components/public-monitoring/PublicWeatherCard.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicTideCard.tsx](resina-project/apps/web/app/components/public-monitoring/PublicTideCard.tsx)
- What changed: added three lightweight public monitoring components that fetch `/api/sensor/current`, `/api/weather/current`, and `/api/tide/current`, and rendered them on the landing page in a new "Monitoring (Public)" section.
- Validation: documentation and typecheck pending; runtime requires API endpoints to exist and be CORS-accessible.

### 2026-06-11 (public-monitoring)

- Prompt: expose admin-style sensor, weather, and tide monitors on the public landing page for unauthenticated users and match admin visuals/behaviour.
- Area: web, api
- Files changed: [resina-project/apps/web/app/page.tsx](resina-project/apps/web/app/page.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicMonitoringSection.tsx](resina-project/apps/web/app/components/public-monitoring/PublicMonitoringSection.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicSensorCard.tsx](resina-project/apps/web/app/components/public-monitoring/PublicSensorCard.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicWeatherCard.tsx](resina-project/apps/web/app/components/public-monitoring/PublicWeatherCard.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicTideCard.tsx](resina-project/apps/web/app/components/public-monitoring/PublicTideCard.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicSensorWrapper.tsx](resina-project/apps/web/app/components/public-monitoring/PublicSensorWrapper.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicWeatherWrapper.tsx](resina-project/apps/web/app/components/public-monitoring/PublicWeatherWrapper.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicTideWrapper.tsx](resina-project/apps/web/app/components/public-monitoring/PublicTideWrapper.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicSensorWrapper.tsx](resina-project/apps/web/app/components/public-monitoring/PublicSensorWrapper.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicWeatherWrapper.tsx](resina-project/apps/web/app/components/public-monitoring/PublicWeatherWrapper.tsx), [resina-project/apps/web/app/components/public-monitoring/PublicTideWrapper.tsx](resina-project/apps/web/app/components/public-monitoring/PublicTideWrapper.tsx), [resina-project/apps/web/.env.local](resina-project/apps/web/.env.local), [resina-project/apps/api/src/index.ts](resina-project/apps/api/src/index.ts)
- What changed: 
	- Added a public "Monitoring (Public)" section on the landing page and three client-side wrapper components that fetch public-safe API endpoints and render the exact admin UI components (`CurrentSensorStatus`, `WeatherUpdateSection`, `TideMonitorSection`).
	- Implemented API endpoints in `apps/api/src/index.ts`: `/api/sensor/current` and `/api/weather/current` that return small, public-safe summaries sourced from Supabase tables. Tide endpoints already existed and are consumed by the tide wrapper.
	- Updated the web wrappers to compute and pass admin-style styling props (e.g., `sensorGradientClass`, `noticeClass`, `weatherCardClass`) so background and alert visuals match the admin dashboard thresholds.
	- Stacked the three monitors vertically on the landing page and increased container widths to match admin sizing.
	- Added `NEXT_PUBLIC_API_URL` to `apps/web/.env.local` to point the web client to the running API during development.
- Validation: runtime validation required — restart API and web dev servers and verify:
	- `GET /api/sensor/current` returns `{ current: { waterLevel, statusLabel, updatedAt }, ... }`.
	- `GET /api/weather/current` returns `{ current: { temperature, humidity, heatIndex, windSpeed, intensityDescription, manualDescription, owmMain, owmDescription, iconPath, updatedAt }, ... }`.
	- `GET /api/tide/current` continues to return `{ current: { currentHeight, state, ... }, extremes: [...] }` and the public tide wrapper now reads `current.currentHeight` and `current.state` to display current tide plus next high/low.

Notes:
- The wrappers intentionally use client-side fetching and are implemented as `use client` components to avoid requiring server-side admin credentials in the public landing page.
- If database table/column names differ in your environment, the API endpoints may need column mapping adjustments; check API logs and the browser console for 4xx/5xx errors.

### 2026-06-05

- Prompt: read the document first, and fix the landing page download button and navbar download link so they install the APK instead of opening the admin portal.
- Area: web
- Files changed: [resina-project/apps/web/app/page.tsx](resina-project/apps/web/app/page.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: switched the landing hero `Download App` CTA to use `NEXT_PUBLIC_APK_DOWNLOAD_URL` (same target as the navbar download button) and removed the unused web portal fallback constant tied to `/admin`.
- Validation: get_errors on `apps/web/app/page.tsx` (no errors found).

### 2026-05-31

- Prompt: show unread notifications first and read notifications below them in the admin notification list.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/components/admin-page-header.tsx](resina-project/apps/web/app/admin/components/admin-page-header.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: added a stable notification sort that places unread items above read items, while keeping newest notifications first inside each group.
- Validation: not run yet; pending TypeScript check.

### 2026-05-31

- Prompt: make read notifications stay read, create a new unread item after that, and show the latest commenter name for unread comment threads.
- Area: web
- Files changed: [resina-project/apps/web/sql/admin_notifications_schema.sql](resina-project/apps/web/sql/admin_notifications_schema.sql), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: added an update policy so `is_read` persists in Supabase, and changed the comment-thread update branch to keep the newest commenter name in the unread notification message.
- Validation: schema reviewed in file; no SQL runtime executed here.

### 2026-05-31

- Prompt: keep the first commenter name in unread comment notifications and use 'name and others' only for comment threads.
- Area: web
- Files changed: [resina-project/apps/web/sql/admin_notifications_schema.sql](resina-project/apps/web/sql/admin_notifications_schema.sql), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: added a stored `actor_name` to notification rows so thread updates keep the original commenter name, while sensor notifications stay single-entry and unaffected.
- Validation: schema reviewed in file; no SQL runtime executed here.

### 2026-05-31

- Prompt: show 'and others' for multiple unread comments on the same post while keeping a single unread notification.
- Area: web
- Files changed: [resina-project/apps/web/sql/admin_notifications_schema.sql](resina-project/apps/web/sql/admin_notifications_schema.sql), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: updated the comment notification trigger so a second unread comment on the same announcement updates the existing unread notification to a 'name and others' message instead of creating another row.
- Validation: schema reviewed in file; no SQL runtime executed here.

### 2026-05-31

- Prompt: debug the admin notifications SQL error about missing `thread_key` on existing tables.
- Area: web
- Files changed: [resina-project/apps/web/sql/admin_notifications_schema.sql](resina-project/apps/web/sql/admin_notifications_schema.sql), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: added `alter table` statements for `thread_key`, `is_read`, and `read_at` so older `admin_notifications` tables can accept the new persistence columns before indexes and triggers use them.
- Validation: documentation only; schema fix reviewed in file.

### 2026-05-31

- Prompt: stop duplicate comment notifications for the same post while unread, but allow a new one after the prior notification is marked read.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/components/admin-page-header.tsx](resina-project/apps/web/app/admin/components/admin-page-header.tsx), [resina-project/apps/web/sql/admin_notifications_schema.sql](resina-project/apps/web/sql/admin_notifications_schema.sql), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: added persisted read state to admin notifications and made the comment trigger skip inserting a new notification when an unread notification already exists for the same announcement thread.
- Validation: npx.cmd tsc --noEmit -p apps/web/tsconfig.json

### 2026-05-31

- Prompt: add a persistent notification table so sensor and comment changes stay in admin notifications.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/components/admin-page-header.tsx](resina-project/apps/web/app/admin/components/admin-page-header.tsx), [resina-project/apps/web/sql/admin_notifications_schema.sql](resina-project/apps/web/sql/admin_notifications_schema.sql), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: switched the admin notification panel to read from `admin_notifications` and added database triggers that insert notification rows when sensor readings or announcement comments are created.
- Validation: not run yet; pending TypeScript check.

### 2026-05-31

- Prompt: remove the Twilio-specific sensor fallback message from the admin dashboard.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/dashboard/page.tsx](resina-project/apps/web/app/admin/dashboard/page.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: replaced the stale "Waiting for Twilio" dashboard error with a generic no-sensor-data message that refers only to Supabase records.
- Validation: not run yet; pending TypeScript check.

### 2026-05-31

- Prompt: add the Sta. Rita logo icon to the landing page alongside the RESINA logo.
- Area: web
- Files changed: [resina-project/apps/web/app/page.tsx](resina-project/apps/web/app/page.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: placed the Sta. Rita icon next to the RESINA logo in the landing page header and footer so the homepage branding shows both marks.
- Validation: not run yet; pending TypeScript check.

### 2026-05-31

- Prompt: match the landing page logo sizes and simplify the download CTA.
- Area: web
- Files changed: [resina-project/apps/web/app/page.tsx](resina-project/apps/web/app/page.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: reduced and nudged the Sta. Rita icon to visually match the RESINA logo, and replaced the two landing buttons with a single `Download` button.
- Validation: not run yet; pending TypeScript check.

### 2026-05-31

- Prompt: match footer logo sizes and make the download CTA less plain.
- Area: web
- Files changed: [resina-project/apps/web/app/page.tsx](resina-project/apps/web/app/page.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: aligned the footer Sta. Rita icon size with the RESINA logo and changed the download text to `Download the App` for a clearer call to action.
- Validation: not run yet; pending TypeScript check.

### 2026-05-31

- Prompt: make the Sta. Rita icon slightly smaller than RESINA and give the download CTA a stronger visual treatment.
- Area: web
- Files changed: [resina-project/apps/web/app/page.tsx](resina-project/apps/web/app/page.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: reduced the Sta. Rita icon size slightly in the header and footer so it visually matches RESINA better, and turned the download label into an icon-backed `Download App` button/link.
- Validation: not run yet; pending TypeScript check.

### 2026-05-31

- Prompt: remove the Sta. Rita icon from the landing page footer.
- Area: web
- Files changed: [resina-project/apps/web/app/page.tsx](resina-project/apps/web/app/page.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: removed the footer Sta. Rita icon while keeping the header branding unchanged.
- Validation: not run yet; pending TypeScript check.

### 2026-05-31

- Prompt: set PDF export to portrait, add Sta Rita icon to PDF/XLSX exports, and fix XLSX recovery XML error.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/history/pdf-report.ts](resina-project/apps/web/app/admin/history/pdf-report.ts), [resina-project/apps/web/app/admin/history/xlsx-report.ts](resina-project/apps/web/app/admin/history/xlsx-report.ts), [resina-project/apps/web/app/admin/history/page.tsx](resina-project/apps/web/app/admin/history/page.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: switched PDF export to portrait orientation with the Sta Rita logo, embedded the Sta Rita icon image into generated XLSX files, and fixed worksheet XML ordering that caused Excel repair/recovery.
- Validation: npx.cmd tsc --noEmit -p apps/web/tsconfig.json

### 2026-05-31

- Prompt: fix analytics report PDF export error so it downloads directly and update docs for the change.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/history/pdf-report.ts](resina-project/apps/web/app/admin/history/pdf-report.ts), [resina-project/apps/web/package.json](resina-project/apps/web/package.json), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: replaced print-window based PDF flow with direct client-side PDF file generation/download and added required PDF dependencies.
- Validation: npm run lint --workspace web

### 2026-05-31

- Prompt: create a compact structure reference for future AI prompts.
- Area: root
- Files changed: [README.md](README.md), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: added a monorepo map, ownership boundaries, and a rule for documenting future edits.
- Validation: documentation only; no code behavior changed.

### 2026-05-31

- Prompt: tweak PDF header text and spacing according to requested layout (Barangay/City and Report Period/Generated At on two lines).
- Area: web
- Files changed: [resina-project/apps/web/app/admin/history/pdf-report.ts](resina-project/apps/web/app/admin/history/pdf-report.ts), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: adjusted the PDF header to display "Barangay: Sta. Rita  City: Olongapo" on the first line and "Report Period: ...  Generated At: ..." on the second line; ensured spacing and formatting; preserved logo placement.
- Validation: npx.cmd tsc --noEmit -p apps/web/tsconfig.json

### 2026-05-31

- Prompt: replace subtitle with two lines for barangay and city and bold only the labels for report metadata.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/history/pdf-report.ts](resina-project/apps/web/app/admin/history/pdf-report.ts), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: removed the small subtitle and added two lines: `Barangay Sta. Rita` and `Lungsod ng Olongapo`; updated metadata row to bold only the labels `Report Period:` and `Generated At:` while leaving the date/time strings normal.
- Validation: npx.cmd tsc --noEmit -p apps/web/tsconfig.json

### 2026-05-31

- Prompt: remove overlapping subtitle and avoid duplicated "Barangay" label in PDF header.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/history/pdf-report.ts](resina-project/apps/web/app/admin/history/pdf-report.ts), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: removed the "Analytics report export" subtitle and print the `barangayName` and `cityName` values directly to prevent the label being duplicated; adjusted vertical spacing to prevent overlap.
- Validation: npx.cmd tsc --noEmit -p apps/web/tsconfig.json

### 2026-05-31

- Prompt: fix admin sidebar top spacing so it does not hide under the header.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/layout.tsx](resina-project/apps/web/app/admin/layout.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: added a desktop top offset to the admin sidebar container so the sticky header no longer crowds the first sidebar section.
- Validation: npx.cmd tsc --noEmit -p apps/web/tsconfig.json

### 2026-05-31

- Prompt: further adjust the admin sidebar so the sticky header does not hide it during navigation.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/layout.tsx](resina-project/apps/web/app/admin/layout.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: increased the desktop sidebar offset to sit below the taller admin header and keep the top sidebar items visible while navigating.
- Validation: not run yet; pending TypeScript check.

### 2026-05-31

- Prompt: fix mobile admin sidebar so the sticky header no longer overlaps it.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/layout.tsx](resina-project/apps/web/app/admin/layout.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: raised the mobile sidebar overlay and panel above the header with higher z-index values so the sidebar fully covers the header when open.
- Validation: documentation only; no compile run in this turn.

### 2026-05-31

- Prompt: keep the admin header hidden behind the open sidebar so the sidebar is the only visible layer on mobile.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/layout.tsx](resina-project/apps/web/app/admin/layout.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: faded and disabled the main header/content area while the mobile sidebar is open, preventing the header from visually competing with the sidebar panel.
- Validation: not run yet; pending TypeScript check.

### 2026-05-31

- Prompt: remove the excess top space above the desktop sidebar.
- Area: web
- Files changed: [resina-project/apps/web/app/admin/layout.tsx](resina-project/apps/web/app/admin/layout.tsx), [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: reset the desktop sidebar wrapper to `top-0` and full viewport height so the sidebar begins flush at the top edge.
- Validation: not run yet; pending TypeScript check.

### 2026-05-31

- Prompt: make the structure reference stricter and reusable as a change template.
- Area: root
- Files changed: [resina-project/PROJECT_STRUCTURE.md](resina-project/PROJECT_STRUCTURE.md)
- What changed: added a fixed per-change template, entry rules, and clearer validation requirements.
- Validation: documentation only; no code behavior changed.

## Update Checklist For Future Tasks

Before changing code:

1. Read this document.
2. Open only the folder that owns the change.
3. Update the change log after the edit.
4. If ownership changes, update the ownership map in the same task.

## Prompt Shortcut

Use this pattern when prompting the AI:

- "Read PROJECT_STRUCTURE.md first, then inspect only the relevant owner folder for the requested change."
