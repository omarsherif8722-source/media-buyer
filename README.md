# G Developments · Media buying dashboard

A private control room for running G Developments' paid campaigns and judging them by **valid leads**: people who answered, can afford the project and want to talk about buying.

It merges two earlier projects:

- the **Hytech marketing dashboard** (`omarsherif8722-source/hytech-marketing`): its password sign-in server, layout (sidebar groups, hairline cards, period switches, phone tab bar) and media-buying ideas;
- the **G Developments advisory website** (`omarsherif8722-source/gdvelepomets-hemaly-`): projects, starting prices, payment plans and availability, copied into `public/data/catalog.json`.

## What it does

| Screen | Use it to |
| --- | --- |
| Command Center (`overview`) | Executive KPI pulse, Dual-Axis SVG Daily Spend vs. Valid Buyers Trend chart, Full-Funnel Conversion Waterfall, 1-Click Decision & Action Engine (Scale +20%, Pause waste, Widen geo), G Developments Portfolio Spend vs. Valid Buyers & ATS Stock matrix, and Grade-A Priority Speed-to-Lead Queue. |
| Egypt & GCC Map (`geo`) | Interactive vector geo-intelligence map of Egypt (Greater Cairo & Nile Delta zoom, All 27 Egypt Governorates, and GCC Expat Hubs: KSA, UAE, Kuwait, Qatar). Color-code by Spend, Valid Buyers, Cost/Valid Lead, Valid Rate %, or Reservations. Click any corridor or governorate to inspect active ad sets and execute 1-click geo retargeting, +20% scaling, exclusion, or 1% Lookalike buyer list export. |
| Website Funnel (`website`) | Live bridge between Meta campaigns and `mahmoud-elhemaly.onrender.com`: Ad Clicks → Landing Page Views (LPV load rate) → On-site Micro-Conversions (Residences tab, Future Home payment finder, 4K film plays, brochure requests) → Direct WhatsApp/Call/Brief macro conversions → Valid Buyers, plus per-project CRO diagnosis and Meta Pixel / CAPI / Umami setup. |
| Campaigns (`campaigns`) | Switch between campaigns in one click. Automated Media Buyer Verdict badges (`Scale +20%`, `Winner · Hold`, `Creative fatigue`, `Fix hook`, `Learning limited`, `Pause waste`), daily campaign sparkline, 1-click +20% budget scaling, status switches, and full targeting editor. |
| Budget planner (`planner`) | Turn a monthly budget into valid leads, meetings and reservations, or work back from a reservation goal. |
| Leads & CRM (`leads`) | Log every lead with automated **Grade A/B/C/D** scoring and **City/Corridor attribution**, Speed-to-Lead SLA conversion chart, 1-click batch sync of valid stages to Meta Conversions API (CAPI), Meta lead-form pull, UTF-16/tab CSV import, export, and backup. |
| Audiences (`audiences`) | Who buys each project, where they live, interests to try, ad sets to start with, custom audiences to build, and customer lists for lookalikes. |
| Messages & Copy (`messages`) | Prices and plans per project, angles, ready ad copy in English and Egyptian Arabic, and lead-form questions that filter for real buyers. |
| Tracked links (`links`) | Website links with UTM tags, Meta's URL parameters, and WhatsApp links with a ref code that traces a lead to its ad. |
| What to sell (`inventory`) | Availability and prices per project from Primary ATS (1,787 units), so money goes where there are homes to sell. |
| Playbook (`guide`) | The daily and weekly routine and the rules for turning things off and up. |

### Demo mode

The **Demo** switch at the top of every screen fills the dashboard with a made-up ad account (six G Developments campaigns over 45 days) and about two thousand made-up leads with stages, so you can show how it tracks results before the real account is connected.

- A banner on every screen says the data is made up.
- In demo mode every call is answered in the browser (`public/js/demo.js`): nothing reaches the server or Meta. Switches, budgets and targeting edits change only the demo.
- Demo leads and settings are stored apart from real ones and never mix. **Reset demo** starts it fresh; switching Demo off brings back your real data exactly as it was.

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
| `public/js/demo.js` | Demo mode: the made-up account and leads, answered in the browser. |
| `public/js/playbook.js` | Audiences and messages per project (filled with live prices). |
| `public/js/views/` | One file per screen, plus the targeting editor. |
| `public/data/catalog.json` | Projects, prices, plans and availability from the website. |
| `scripts/sync-website.mjs` | Rebuilds the catalog from the website's data. |
| `scripts/check.mjs` | End-to-end checks with a stand-in Meta API. |
