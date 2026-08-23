# Stitch design prompts — AI Integration Hub

Paste the **Design system** block into Stitch once at the start of a project (or repeat its key
terms inside each page prompt if Stitch doesn't retain project-level style context). Then paste one
page prompt at a time. Each prompt already includes the content that page needs to show, pulled
from the actual schema and tools this Hub runs today — no filler copy.

Product: **AI Integration Hub**, by **Innov-AI-tive GmbH** (Bahnhofplatz 1, 91054 Erlangen,
Germany). A control plane that lets a company's AI agents safely call external commerce systems
(WooCommerce, Shopware, and more later) through one set of canonical tools, gated by a policy
engine, a human-approval queue, and a full audit trail. Audience is mixed: technical integrators
setting up API keys and agent permissions, and operational staff (studio managers, support leads)
who just need to approve or deny a request they understand in plain language.

Every screen must support **English and German**, switchable from a header toggle. Design English
copy first, but size buttons/labels/nav items with ~30% extra breathing room — German strings run
longer (e.g. "Approve" → "Genehmigen", "Pending Approvals" → "Ausstehende Genehmigungen") and a
tight English-only layout will break the moment German is dropped in.

---

## Design system

Give this to Stitch as the shared visual language before the first page prompt:

> Visual direction: "Control Ledger" — the product is an audit ledger and policy blueprint for AI
> agents, so the UI should feel like a precise engineering instrument, not a generic gradient SaaS
> dashboard. Cool, slightly blue-grey paper ground (`#F4F5F7` light / `#0D1017` dark) — never warm
> cream, never pure white. Ink is near-black with a blue bias (`#14181F` light / `#E7E9EE` dark).
> One confident flat brand accent, a deep indigo (`#2F3EA6` light / `#5B6EE8` dark) — no gradients,
> used sparingly for primary actions and the active nav item only. Status is communicated with
> three semantic colors kept visually distinct from the brand accent and from each other: allow/ok
> is a muted forest green (`#1F8A5A`), require-approval/pending is an earthy amber (`#B5730B`, not
> neon yellow), deny/error is a brick red (`#B23B3B`, not neon). Every status also carries a small
> filled dot plus a text label — never color alone. Typography: headings in Archivo (geometric,
> engineered character, weight 600–700), body text in IBM Plex Sans, and every technical value —
> tool names like `orders.refund`, UUIDs, JSON, API keys, timestamps — in IBM Plex Mono with
> `font-variant-numeric: tabular-nums` so columns of numbers/timestamps align. Layout: a persistent
> left icon+label rail (Dashboard, Integrations, Agents, Approvals, Audit Logs, API Keys, Help,
> Settings), a slim top bar with an Organization › Project breadcrumb, the EN/DE toggle, and a user
> menu. Content areas use hairline `1px` dividers (not shadows or heavy borders) between rows, like
> ledger lines on graph paper — a faint dot-grid texture at very low opacity is welcome in empty
> states and the landing page hero, echoing blueprint paper. Corners are only slightly rounded
> (4–6px), not the rounded-2xl pill look. No emoji as UI iconography — use precise line icons.

---

## 1. Landing page (public, marketing)

**Purpose:** The first thing a prospective customer (an engineering lead at a company running
several products) sees. Has to explain "canonical capability, not platform API" in one screen.

**Prompt:**
> Design a public marketing homepage for "AI Integration Hub." Hero section: headline "One
> canonical tool. Every commerce platform." Subheadline: "Your AI agents call `orders.get` or
> `orders.refund` once — Shopware today, WooCommerce today, Shopify and Magento next — without ever
> touching a platform-specific API or holding a credential." A code-style panel in the hero (IBM
> Plex Mono, dark-ledger card) shows a short realistic snippet: an agent calling `orders.refund`,
> the policy engine responding `require_approval`, then an approval line, then a real refund
> result — as three stacked terminal-style lines with timestamps, so the pipeline is visible at a
> glance. Below the hero, three columns titled "Connect once" / "Control access" / "Audit
> everything," each with one line icon and two sentences of real product description (integrations,
> per-agent tool permissions with allow/deny/require-approval, and a searchable audit log). A strip
> of supported platform names (WooCommerce, Shopware 6, Shopify — coming soon, Magento — coming
> soon) as plain wordmarks, not logos. Footer with company identity: "A product of Innov-AI-tive
> GmbH, Erlangen, Germany," plus links Imprint / Privacy Policy / Help, and the EN/DE toggle. Header
> has Sign in and a primary "Get started" button in the brand indigo.

---

## 2. Sign in / Sign up

**Purpose:** Auth screen, used by every role.

**Prompt:**
> Design a split-screen auth page. Left half: the "Control Ledger" visual — a faint dot-grid
> blueprint background behind a vertical timeline of small ledger entries (mock audit-log rows like
> "orders.refund · require_approval · 2 min ago") that appears to scroll slowly, communicating "this
> is being watched." Right half: a centered card with tabs "Sign in" / "Create account," email and
> password fields, a primary indigo submit button, and a subtle link "Forgot password?" Include the
> EN/DE toggle in the top-right corner outside the card. Keep the card narrow (max ~380px) and the
> form the visual focus — the ledger animation on the left should feel calm, not busy.

---

## 3. Onboarding — create Organization & Project

**Purpose:** First-run flow immediately after signup, before any real data exists.

**Prompt:**
> Design a two-step onboarding flow, shown as a single centered card with a 2-step progress
> indicator at the top ("1. Organization" / "2. Project"). Step 1: a short explanation — "An
> Organization is your company. Every Project inside it can connect its own stores and agents." —
> plus a single input "Organization name" and a "Continue" button. Step 2: explanation — "A Project
> groups one product's integrations, agents, and approvals. You can create more later." — input
> "Project name" and a "Create project" button. No sidebar yet at this stage; it's a focused,
> distraction-free setup wizard on the same cool ledger-paper background as the rest of the app.

---

## 4. Dashboard (project overview)

**Purpose:** Landing screen once inside a project — the "at a glance" view.

**Prompt:**
> Design the main dashboard for a project called "YogaPilot Merch." Top bar breadcrumb reads
> "Toasternet › YogaPilot Merch." Four stat cards in a row: "Connected integrations" (2), "Active
> agents" (1), "Pending approvals" (highlighted in amber if > 0, currently 1), "Errors today" (0,
> shown in the ok-green style when zero). Below, a two-column layout: left column "Recent activity"
> — a ledger-style list of the last 5 audit log rows, each showing timestamp, tool name in
> monospace (e.g. `orders.get`, `orders.refund`), the status dot + label (allowed / require
> approval / executed / error), and which integration it ran against (WooCommerce or Shopware icon).
> Right column "Pending approvals" — a compact card per pending item showing the tool name, a one
> line summary of the input (e.g. "Refund order #14 — reason: customer changed their mind"), and
> Approve/Deny buttons directly on the card so a manager can act without leaving the dashboard.

---

## 5. Integrations

**Purpose:** List connected platforms; connect a new one.

**Prompt:**
> Design an Integrations page. A table/list of connected stores, each row showing: a small platform
> mark (WooCommerce or Shopware, plain wordmark-style, not a logo image), the integration's given
> name (e.g. "Merch Store," "Shopware Demo"), a status pill (Connected — green dot, Error — red dot
> with the error message truncated beside it, Pending — amber dot), and a "Test connection" icon
> button per row. A prominent "+ Connect a store" button opens a right-side drawer: a platform
> picker showing WooCommerce and Shopware as selectable cards (with Shopify and Magento shown
> disabled/"coming soon"), then once picked, a simple credential form (Store URL, Consumer
> Key/Client ID, Consumer Secret/Client Secret — label the two credential fields differently per
> platform) and a "Connect & test" button. Show a success state (green banner "Connected — 3
> capabilities discovered: orders.search, orders.get, orders.refund") and a failure state (red
> banner with a real, specific error message, e.g. a DNS/connection failure) as two variants of the
> same drawer.

---

## 6. Agents & permissions

**Purpose:** Manage agents and their per-tool policy (the core governance screen).

**Prompt:**
> Design an Agents page. Left side: a simple list of agents (e.g. "Merch Support Agent," status
> Active) with a "+ New agent" button. Selecting one shows, on the right, a permissions matrix: rows
> are canonical tools (`orders.search`, `orders.get`, `orders.refund`), columns let you set the
> permission for "All integrations" or a specific one (Merch Store, Shopware Demo) as a segmented
> control with three options styled with the semantic colors — Allow (green), Require approval
> (amber), Deny (red/muted grey when unset). Show `orders.refund` currently set to "Require
> approval" and `orders.get`/`orders.search` set to "Allow" to make the default policy visible. Add
> a small info callout near `orders.refund`: "High-risk tool — defaults to Require approval for
> every new agent." Keep the matrix dense and scannable, ledger-style with hairline row dividers,
> since this is the screen an admin audits most carefully.

---

## 7. Approvals inbox

**Purpose:** Where a human decides on halted actions — must be understandable with zero technical
background.

**Prompt:**
> Design an Approvals inbox as a queue of cards, newest first, tab-switchable between "Pending" (1),
> "Decided" history. Each pending card: the agent's name, a plain-language action summary generated
> from the tool and input — e.g. "Merch Support Agent wants to refund order #14 on Merch Store.
> Reason given: 'Customer changed their mind.'" — a collapsible "Show technical details" section
> revealing the raw tool name (`orders.refund`) and JSON input in monospace for anyone who wants it,
> and two large, unambiguous buttons: "Approve — run it now" (indigo/primary) and "Deny" (outlined,
> muted). After a decision, the card animates into the "Decided" tab showing who decided it and
> when, and — critically — the real result: for an approved refund, show the actual confirmation
> (e.g. "Refund #16 created on Merch Store") so the approver sees proof it actually happened, not
> just a status change.

---

## 8. Audit logs

**Purpose:** Full searchable history — the compliance/trust surface.

**Prompt:**
> Design an Audit Logs page as a dense, filterable ledger table. Columns: Timestamp (monospace,
> tabular numerals), Tool (monospace, e.g. `orders.refund`), Integration (platform icon + name),
> Agent, Status (dot + label: Allowed / Denied / Require approval / Error, each in its semantic
> color), and a truncated Detail column (either the error message or a short result summary). A
> filter bar above the table: tool name search, status multi-select (using the same colored dot
> chips), and a date range. Include one realistic error row (e.g. "The payment gateway for this
> order does not support automatic refunds") to show the table handles long real messages
> gracefully with truncation + tooltip, not by breaking the row height.

---

## 9. API keys (developer)

**Purpose:** Where an engineer integrating a product (like YogaPilot) via the SDK gets credentials.

**Prompt:**
> Design a Developer / API Keys settings page. A list of existing keys showing name, a masked value
> (e.g. `hub_••••••••3f2a`), created date, and last-used date — never the full secret after
> creation. A "+ Create API key" button opens a modal: name field, then on creation a one-time
> reveal screen with the full key in a monospace box, a copy button, and a firm warning banner: "This
> is the only time you'll see this key — store it now." Below the key list, a compact "Quick start"
> panel showing a real, short code sample (Node.js) calling the Hub SDK to run `orders.get`, so a
> developer can copy-paste and go without leaving the page.

---

## 10. Help & documentation center

**Purpose:** Role-aware guidance — the request explicitly calls for a page so every role
understands how to use the system.

**Prompt:**
> Design a Help Center landing page with a search bar at the top and three clearly labeled audience
> paths below it, each a distinct card: "I approve or deny requests" (for operational
> managers — links to guides like "Understanding an approval request," "What happens when I
> approve?"), "I connect stores and manage agents" (for admins — "Connecting WooCommerce,"
> "Connecting Shopware," "Setting tool permissions"), and "I'm integrating via API/SDK" (for
> developers — "Authentication," "Calling your first tool," "Handling `require_approval`
> responses"). Below the three paths, a "Popular articles" list and a persistent small support
> widget in the corner ("Still stuck? Contact info@innov-ai-tive.de"). Use the same ledger visual
> language as the rest of the app, but warmer/friendlier in tone — slightly more whitespace, larger
> body text, since this page is read start-to-finish rather than scanned.

---

## 11. Imprint (Impressum)

**Purpose:** Legally required for a German company (Telemediengesetz §5). Must be plain, complete,
and easy to find — not styled as marketing.

**Prompt:**
> Design a plain, single-column legal page titled "Imprint" (with a German label "Impressum"
> visible via the language toggle). Deliberately unglamorous — no hero, no cards, just clearly
> labeled sections in body text on the ledger-paper background: "Innov-AI-tive GmbH, Bahnhofplatz 1,
> 91054 Erlangen, Germany." "Commercial Register: Amtsgericht Fürth, HRB 13346." "Represented by:
> Managing Director Tobias Hartmann." "Contact: info@innov-ai-tive.de, www.innov-ai-tive.de." Include
> a short "Responsible for content" line naming the same managing director, and a brief EU dispute
> resolution notice paragraph (standard for a German commercial site). Typeset as calm, readable
> body text with generous line height — this page exists to be trusted at a glance, not designed.

---

## 12. Privacy Policy (Datenschutzerklärung)

**Purpose:** Required alongside the Imprint under GDPR for any site handling user accounts — a
necessary companion, not scope creep, since this product stores email addresses, API keys, and
integration credentials.

**Prompt:**
> Design a Privacy Policy page matching the Imprint's plain, single-column legal style (same
> typography and background, no decoration). Structure it with a left-hand sticky table of contents
> (section anchors) and body sections on the right: "Data controller" (Innov-AI-tive GmbH, same
> address as the Imprint), "What we collect" (account email, organization/project membership,
> encrypted integration credentials, audit logs of tool calls), "Why we process it" (providing the
> service, security/audit obligations), "Third parties" (the external commerce platforms you
> connect, only insofar as your agents call them), "Your rights under GDPR" (access, correction,
> deletion, portability, complaint to a supervisory authority), and "Contact" (info@innov-ai-tive.de).
> Keep paragraphs short and scannable with bold lead-ins per section, still on the calm ledger-paper
> ground, still legible over decoration.

---

## Notes for whoever builds these after Stitch

- Keep the EN/DE toggle mechanism consistent across every generated screen — same position (top
  bar, right side), same visual treatment, before wiring real i18n.
- The Imprint and Privacy Policy content above is real (from the request) — carry it through
  verbatim into the built page; don't let Stitch's placeholder text survive into implementation.
- Status colors (allow/require-approval/deny) must stay consistent across every screen that shows
  them — Dashboard, Agents matrix, Approvals, Audit Logs. Pull them from one shared token set once
  this moves from Stitch mockups into real CSS.
