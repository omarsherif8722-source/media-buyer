// The media buyer's playbook: the routine and rules behind the dashboard.
import { html } from "../ui.js";

const S = [
  {
    t: "Every morning (15 minutes)",
    items: [
      "Overview → Needs attention. Deal with red items first.",
      "Call or WhatsApp every new lead from the night. Aim for the first contact within 15 minutes during working hours.",
      "Give yesterday's leads a stage. No stage, no valid-lead numbers.",
      "Campaigns → Yesterday: spend on plan? Anything spending with no leads?",
    ],
  },
  {
    t: "Twice a week",
    items: [
      "Campaigns → 7 days: rank ad sets by cost per valid lead, not cost per lead.",
      "Raise the budget of the best ad set by 15–20%. Never more than that in one step.",
      "Turn off ads with high frequency and falling CTR, and add one or two new ones.",
      "Get leads from Meta (or import the download) so nothing is missed.",
    ],
  },
  {
    t: "Every week (Sunday)",
    items: [
      "Leads → Lead quality by campaign: which campaigns bring people who meet and reserve?",
      "Move money from the worst project or audience to the best one.",
      "Send the week's numbers to G Developments: spend, valid leads, cost per valid lead, meetings, reservations.",
      "Backup the leads.",
    ],
  },
  {
    t: "Rules for turning things off and up",
    items: [
      "Wait for spend of about 2× your target cost per lead before judging an ad.",
      "No leads after 2× target cost per lead: turn the ad off.",
      "Ten or more contacted leads and none valid: the audience or the message is wrong. Add the price to the ad and a budget question to the form before spending more.",
      "An ad set in learning: avoid edits for 3–4 days. Every big edit restarts learning.",
      "Budgets: raise 15–20% at a time, every 2–3 days, while the cost per valid lead holds.",
    ],
  },
  {
    t: "Getting valid leads, not just leads",
    items: [
      "Show the starting price and the plan in the ad. People who cannot reach it do not apply.",
      "Use Higher intent instant forms with multiple-choice questions on budget, timing and payment.",
      "Speed: the first adviser to call usually wins. Leads cool down within hours.",
      "Write the reason when a lead is not valid. The reasons tell you what to change.",
      "Tell Meta which leads were valid (META_DATASET_ID). Meta then looks for more people like them.",
      "Send ads to the project's own page, not the home page, and keep the WhatsApp button in view.",
    ],
  },
  {
    t: "Before launching a campaign",
    items: [
      "Name it: GD | Project | Objective | Audience | Month (e.g. GD | Krypton | Leads | Broad | Nov). The dashboard reads the project from the name.",
      "Special ad category: Housing, if any ad set reaches the US, Canada or Europe.",
      "Pixel and Conversions API working on the website; test with Meta's Test Events.",
      "Lead form tested: send a test lead and check it arrives.",
      "Tracked links and ref codes ready for every ad.",
      "Inventory checked in What to sell: never advertise what is sold out.",
      "Start the budget so each ad set can reach about 50 results a week, or use fewer ad sets.",
    ],
  },
];

export function render() {
  return html`
  <div class="top"><div><h1>Playbook</h1><p class="sub">The routine that keeps campaigns bringing real buyers. Rules of thumb to start with; your own numbers win once you have them.</p></div></div>
  <div class="grid g2">${S.map((s) => html`<div class="card"><h2>${s.t}</h2><ul class="list" style="margin-top:10px">${s.items.map((i) => html`<li>${i}</li>`)}</ul></div>`)}</div>`;
}
