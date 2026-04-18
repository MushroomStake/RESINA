# RESINA

## Root Monorepo Commands

Run these from the repository root at `resina-project/`.

| Scope | Purpose | Command |
| --- | --- | --- |
| Web | Start Next.js dev server | `npm run dev:web` |
| Web | Build production bundle | `npm run build:web` |
| Web | Start production server | `npm run start:web` |
| Web | Run lint checks | `npm run lint:web` |
| API | Start API in watch mode | `npm run dev:api` |
| API | Build API TypeScript | `npm run build:api` |
| API | Start built API | `npm run start:api` |
| API | Fetch tide data | `npm run tide:fetch` |
| API | Interpolate hourly tide data | `npm run tide:interpolate` |
| API | Refresh tide window | `npm run tide:refresh-window` |
| API | Fetch weather snapshot | `npm run weather:fetch` |
| Mobile | Start Expo | `npm run start:mobile` |
| Mobile | Run Android | `npm run android:mobile` |
| Mobile | Run iOS | `npm run ios:mobile` |
| Mobile | Run mobile web target | `npm run web:mobile` |

### Default Shortcuts

These default to web:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`