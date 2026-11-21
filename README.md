# G Developments · Media buying dashboard

A private control room for running G Developments' paid campaigns and judging them by **valid leads**: people who answered, can afford the project and want to talk about buying.

It merges two earlier projects:

- the **Hytech marketing dashboard** (`omarsherif8722-source/hytech-marketing`): its password sign-in server, layout (sidebar groups, hairline cards, period switches, phone tab bar) and media-buying ideas;
- the **G Developments advisory website** (`omarsherif8722-source/gdvelepomets-hemaly-`): projects, starting prices, payment plans and availability, copied into `public/data/catalog.json`.

## What it does

| Screen | Use it to |
| --- | --- |
| Overview | See spend, leads, valid leads, cost per valid lead, meetings and reservations for the chosen dates; what needs attention; who to call first; your targets. |
| Campaigns | Switch between campaigns in one click. Turn campaigns, ad sets and ads on or off. Change budgets. Open the targeting editor. Read Meta's numbers next to valid leads and cost per valid lead. |
| Budget planner | Turn a monthly budget into valid leads, meetings and reservations, or work back from a reservation goal. |
| Leads | Log every lead and give it a stage after the first call. Pull Meta lead-form leads, import Meta's lead download, export, back up. Lead quality by campaign. |
| Audiences | Who buys each project, where they live, interests to try, ad sets to start with, custom audiences to build, and customer lists for lookalikes. |
| Messages | Prices and plans per project, angles, ready ad copy in English and Egyptian Arabic, and lead-form questions that filter for real buyers. |
| Tracked links | Website links with UTM tags, Meta's URL parameters, and WhatsApp links with a ref code that traces a lead to its ad. |
| What to sell | Availability and prices per project, so money goes where there are homes to sell. |
| Playbook | The daily and weekly routine and the rules for turning things off and up. |

### Valid leads

A lead counts as **valid** at the stage "Real interest" or any later stage (meeting, visit, reserved, sold, or interested-then-lost). "No answer", wrong numbers, brokers, job seekers, low budgets and "just looking" are not valid. Cost per valid lead = spend ÷ valid leads for the same dates.

## Privacy

- **This repository is public.** Nothing private is stored in it: no leads, no figures from the ad account, no tokens.
- The Meta token lives only on the server (Render environment variables). The browser never sees it.
- Leads, notes, saved links and targets are kept **in the browser** (local storage) on each device. Use Leads → Backup and Restore to move them between your laptop and phone, and keep a backup.
- Consider making the repository private on GitHub (Settings → General → Danger Zone → Change visibility).

## Connect the ad account

1. Get access to the G Developments ad account and Facebook Page (partner or employee access in their Business Manager).
2. Business settings → Users → **System users** → Add (Admin) → **Assign assets**: the ad account with *Manage campaigns*, and the Page.
3. **Generate token** with `ads_management`, `ads_read`, `business_management`, `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`.
4. Set these on Render (Environment):

| Variable | Needed | What |
| --- | --- | --- |
| `DASHBOARD_PASSWORD` | yes | 12+ characters. Username is `media` (change with `DASHBOARD_USER`). |
| `META_ACCESS_TOKEN` | yes | The system user token. |
| `META_AD_ACCOUNT_ID` | yes | `act_…` from Ads Manager. |
| `META_PAGE_ID` | for lead forms | The Page that owns the instant forms. |
| `META_DATASET_ID` | optional | Pixel / dataset id. Sends valid-lead stages back to Meta (Conversions API for CRM) so Meta can find more people like them. Set up the matching events in Events Manager first. |
| `META_READ_ONLY` | optional | `1` = look only; every change is blocked. Good for the first days. |
| `META_MAX_DAILY_BUDGET` | optional | Highest daily budget the dashboard may set. |
| `META_API_VERSION` | optional | Graph API version, default `v23.0`. |

### Safety on changes

- Every change asks for confirmation and shows before → after.
- The server only changes **status** (on/off), **budget** and these targeting fields: locations, excluded locations, ages, gender, interests and job titles, custom audiences.
- It checks that every item belongs to `META_AD_ACCOUNT_ID` before changing it.
- Every change is written to Render's log (`META CHANGE …`) and listed under Campaigns → Changes made from this dashboard.
- Meta reads are cached for one minute to stay inside Meta's rate limits; any change clears the cache.

## Run it

No build step and no packages to install. Node 20 or newer.

```bash
DASHBOARD_PASSWORD=choose-a-long-password node server.mjs
```

Then open http://localhost:4173 and sign in with `media` and the password. Without the Meta variables it runs with every screen except live campaigns.

Check everything (sign-in, every Meta read and write against a stand-in Meta API, browser code):

```bash
npm run check
```

The check proves the dashboard sends Meta the right requests; only the real ad account can prove Meta accepts them. Start with `META_READ_ONLY=1` on the first day.

## Update the website data

After the website's data changes (new ATS sheet, new payment plans):

```bash
node scripts/sync-website.mjs ../mahmoud-elhemaly-site
```

Commit `public/data/catalog.json` and push.

## Host on Render

1. Render → New → **Blueprint** → pick this repository (`render.yaml` sets the free plan, Frankfurt).
2. Enter `DASHBOARD_PASSWORD` and the Meta variables when asked.
3. Open the `onrender.com` link and sign in. The free plan sleeps after ~15 minutes idle; the first visit after that takes about a minute.

### Install on your phone

Open the link in Safari (iPhone: Share → Add to Home Screen) or Chrome (Android: ⋮ → Install app). It opens full screen. Leads on the phone are separate from the laptop's: use Backup / Restore.

## Files

| Path | What |
| --- | --- |
| `server.mjs` | Sign-in (from the Hytech dashboard), static files, `/api/*`. |
| `lib/meta.mjs` | Meta Marketing API: reads, guarded writes, lead forms, lead stages to Meta, change log. |
| `public/js/app.js` | Shell, routing, dates, loading data. |
| `public/js/model.js` | Lead stages, valid leads, lead quality per campaign / ad set / ad, alert rules. |
| `public/js/playbook.js` | Audiences and messages per project (filled with live prices). |
| `public/js/views/` | One file per screen, plus the targeting editor. |
| `public/data/catalog.json` | Projects, prices, plans and availability from the website. |
| `scripts/sync-website.mjs` | Rebuilds the catalog from the website's data. |
| `scripts/check.mjs` | End-to-end checks with a stand-in Meta API. |
