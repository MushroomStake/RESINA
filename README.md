# RESINA

**One platform. Every surface.**

RESINA is a centralized landing page that bridges mobile and web platforms, giving teams a single source of truth for products, users, and growth.

## Project Structure

```
RESINA/
├── index.html      # Main landing page
├── styles.css      # Styles and design system
├── script.js       # Interactivity (nav, pricing toggle, animations)
├── vercel.json     # Vercel deployment configuration
└── README.md
```

## Features

- **Unified Dashboard** – Monitor web and mobile apps side-by-side
- **Native Mobile Support** – First-class iOS & Android integration
- **Cross-Platform Data** – One user identity across platforms
- **Real-Time Sync** – Push updates to web and mobile simultaneously
- **Enterprise Security** – SOC 2, RBAC, SSO
- **Release Management** – Schedule and roll back releases across platforms

## Development

Open `index.html` in any browser — no build step required.

```bash
# Optional: serve locally with any static server
npx serve .
```

## Deployment (Vercel)

The site is configured for zero-config deployment on [Vercel](https://vercel.com).

1. Import the repository into Vercel
2. Vercel will auto-detect the static site via `vercel.json`
3. Every push to the default branch deploys automatically

Or deploy instantly with the Vercel CLI:

```bash
npx vercel
```
