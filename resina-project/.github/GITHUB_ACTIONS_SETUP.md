# GitHub Actions Setup for Tide Monitoring

## Quick Setup (3 steps)

### Step 1: Push Workflow to GitHub
```bash
git add .github/workflows/daily-tide-fetch.yml
git commit -m "feat: add automatic daily tide fetch workflow"
git push origin main
```

### Step 2: Add GitHub Secrets
Go to your repository → **Settings > Secrets and variables > Actions**

Click **"New repository secret"** and add:

| Secret Name | Value |
|-------------|-------|
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Your service role key from Supabase Settings > API |
| `STORMGLASS_API_KEY` | `your-stormglass-api-key` |

### Step 3: Verify Workflow
Go to **Actions** tab → Click **Daily Tide Fetch**

Should show:
```
✅ Latest run
- Checkout repository
- Setup Node.js
- Install dependencies
- Fetch tide data from StormGlass
- Generate hourly tide interpolations
- Notify on success
```

---

## How It Works

⏰ **Timing:** Runs automatically at **12:01 AM UTC** every day
- Adjust the cron schedule if needed (see table below)

🔄 **Process:**
1. GitHub runner checks out your repo
2. Installs Node.js & dependencies
3. Runs `npm run tide:fetch` (fetches extremes from StormGlass or cache)
4. Runs `npm run tide:interpolate` (generates hourly estimates)
5. Stores results in Supabase

✅ **Result:** Fresh tide data every morning, ready for your users

---

## Cron Schedule Reference

Change the schedule in `.github/workflows/daily-tide-fetch.yml`:

```yaml
on:
  schedule:
    - cron: '1 0 * * *'  # 12:01 AM UTC (current)
```

| Time | Cron Expression |
|------|-----------------|
| 12:01 AM UTC | `1 0 * * *` |
| 6:00 AM UTC | `0 6 * * *` |
| 12:00 PM UTC (noon) | `0 12 * * *` |
| 6:00 PM UTC | `0 18 * * *` |
| 8:00 PM UTC+8 (Manila) | `0 12 * * *` |

---

## Manual Trigger

Need to run outside the schedule?

1. Go to **Actions** tab
2. Click **Daily Tide Fetch** in left sidebar
3. Click **Run workflow** button
4. Select branch (main)
5. Click **Run workflow**

Done! Tide fetch runs immediately.

---

## Monitoring & Troubleshooting

### View Workflow Logs

1. Go to **Actions** tab
2. Click **Daily Tide Fetch**
3. Click latest run
4. View step-by-step output

### Common Issues

**❌ "SUPABASE_SERVICE_KEY not found"**
→ Add it to repository secrets (Step 2 above)

**❌ "npm run tide:fetch failed"**
→ Check logs for error message
→ Verify API keys in secrets are correct
→ Ensure Supabase tables exist

**❌ "npm ci failed"**
→ Ensure `apps/api/package-lock.json` exists
→ Try: `cd apps/api && npm install && npm ci`

---

## Cost & Limits

| Resource | Free Tier |
|----------|-----------|
| Workflow runs | ∞ (unlimited) |
| Minutes/month | 2,000 free |
| This workflow/month | ~1,500 min used (30 runs × 50 min = 1,500) |
| **Remaining** | **500 minutes** ✅ |

Your tide fetch uses ~50 seconds per run, so you have plenty of free GitHub Actions minutes!

---

## Security Notes

✅ **Secrets are encrypted** and never exposed in logs
✅ **Service key only used** during workflow (not stored locally)
✅ **API key rotated periodically** by StormGlass if needed

---

## Next Steps

After setup, your tide monitoring is **fully automated**:
- ✅ Cron job handled by GitHub (no Vercel Pro needed)
- ✅ Runs reliably every day
- ✅ Data syncs to Supabase
- ✅ Mobile app displays fresh predictions
- ✅ Zero additional cost

Done! 🎉
