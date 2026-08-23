# Stitch design prompt — AI Integration Hub

One prompt, paste it whole into Stitch.

---

Design the full web app for **"AI Integration Hub,"** a product of Innov-AI-tive GmbH (Bahnhofplatz
1, 91054 Erlangen, Germany; Managing Director Tobias Hartmann; Amtsgericht Fürth HRB 13346;
info@innov-ai-tive.de). It's a control plane that lets a company's AI agents safely call external
commerce systems — WooCommerce and Shopware 6 today, Shopify and Magento next — through one
canonical set of tools (`orders.search`, `orders.get`, `orders.refund`) instead of a different API
per platform. Every tool call is gated by a policy (Allow / Deny / Require approval), high-risk
calls like refunds park in a human approval queue instead of running immediately, and every call is
written to a permanent audit log. The audience is mixed: technical people wiring up API keys and
per-agent tool permissions, and non-technical operations staff who just need to approve or deny a
plain-language request. Every screen must support English and German via a header toggle — design
English copy but leave ~30% extra room in buttons/labels/nav items, since German strings run longer
("Approve" → "Genehmigen").

**Visual direction — "Control Ledger":** this is an audit ledger and policy blueprint for AI agents,
so it should feel like a precise engineering instrument, not a generic gradient SaaS dashboard. Cool
blue-grey paper ground (`#F4F5F7` light / `#0D1017` dark) — never warm cream, never pure white. Ink
near-black with a blue bias (`#14181F` light / `#E7E9EE` dark). One flat brand accent, a deep
indigo (`#2F3EA6` light / `#5B6EE8` dark), no gradients, used only for primary actions and the
active nav item. Three semantic status colors, kept visually distinct from the brand accent and
from each other, always paired with a small dot plus a text label (never color alone): allow/ok is
muted forest green (`#1F8A5A`), require-approval/pending is earthy amber (`#B5730B`, not neon),
deny/error is brick red (`#B23B3B`, not neon). Headings in Archivo (weight 600–700), body in IBM
Plex Sans, and every technical value — tool names like `orders.refund`, UUIDs, JSON, API keys,
timestamps — in IBM Plex Mono with aligned tabular numerals. Layout: a persistent left icon+label
nav rail, a slim top bar with an Organization › Project breadcrumb, the EN/DE toggle, and a user
menu. Hairline 1px dividers between rows, like ledger lines on graph paper, not shadows. A faint
low-opacity dot-grid texture is welcome in empty states and the landing hero. Corners only slightly
rounded (4–6px). No emoji as UI iconography — precise line icons only.

Design these screens as one connected app, reusing the same nav rail, top bar, and status/color
language throughout:

1. **Landing page** (public) — headline "One canonical tool. Every commerce platform." A dark
   ledger-style code panel in the hero shows a realistic three-line pipeline: an agent calling
   `orders.refund`, the policy responding `require_approval`, then a real refund result — so the
   whole product logic is visible at a glance. Three columns below: "Connect once," "Control
   access," "Audit everything," each with a line icon and two real sentences. A row of supported
   platform names as plain wordmarks (WooCommerce, Shopware 6, Shopify — coming soon, Magento —
   coming soon). Footer with the company identity above, links to Imprint / Privacy Policy / Help,
   and the EN/DE toggle. Header has Sign in and a primary "Get started" button.

2. **Sign in / Sign up** — split screen. Left half: the dot-grid blueprint background behind a
   slow vertical scroll of mock ledger entries (e.g. "orders.refund · require_approval · 2 min
   ago"). Right half: a narrow centered card, tabs Sign in / Create account, email + password,
   primary indigo submit, "Forgot password?" link. EN/DE toggle top-right, outside the card.

3. **Onboarding** — a focused two-step wizard card, no nav rail yet. Step 1 "Organization": one
   line explaining an Organization is the company, one input, Continue. Step 2 "Project": one line
   explaining a Project groups one product's integrations/agents/approvals, one input, "Create
   project."

4. **Dashboard** — breadcrumb "Toasternet › YogaPilot Merch." Four stat cards: Connected
   integrations (2), Active agents (1), Pending approvals (1, amber-highlighted), Errors today (0,
   green). Two columns below: "Recent activity" as a ledger list of the last 5 audit rows
   (timestamp, monospace tool name, status dot+label, integration icon); "Pending approvals" as
   compact actionable cards (tool name, one-line plain summary like "Refund order #14 — reason:
   customer changed their mind," Approve/Deny buttons right on the card).

5. **Integrations** — a list of connected stores (platform wordmark, given name e.g. "Merch
   Store"/"Shopware Demo," status pill Connected/Error/Pending, per-row "Test connection" button).
   "+ Connect a store" opens a drawer: platform picker (WooCommerce, Shopware selectable; Shopify,
   Magento shown disabled "coming soon"), then a credential form (Store URL + Consumer Key/Client
   ID + Consumer Secret/Client Secret, labeled per platform), "Connect & test" button, and both a
   success state ("Connected — 3 capabilities discovered: orders.search, orders.get,
   orders.refund") and a failure state (specific real error message) as two variants.

6. **Agents & permissions** — agent list on the left ("Merch Support Agent," Active) with "+ New
   agent." Selecting one shows a permissions matrix on the right: rows are the three canonical
   tools, columns let you set Allow/Require approval/Deny (as a 3-way segmented control in the
   semantic colors) per integration or "All integrations." Show `orders.refund` defaulted to
   Require approval and the other two to Allow, with a callout: "High-risk tool — defaults to
   Require approval for every new agent."

7. **Approvals inbox** — a queue of cards (Pending tab, Decided history tab). Each pending card: a
   plain-language summary ("Merch Support Agent wants to refund order #14 on Merch Store. Reason
   given: 'Customer changed their mind.'"), a collapsible "Show technical details" (raw tool name +
   JSON input in monospace), and two large buttons — "Approve — run it now" (primary) and "Deny"
   (outlined). A decided card shows who decided it, when, and the real result (e.g. "Refund #16
   created on Merch Store"), not just a status flip.

8. **Audit logs** — a dense filterable ledger table: Timestamp (monospace, tabular numerals), Tool
   (monospace), Integration (icon+name), Agent, Status (dot+label), truncated Detail (error or
   result). Filter bar: tool search, status multi-select as colored chips, date range. Include one
   long realistic error row (e.g. "The payment gateway for this order does not support automatic
   refunds") truncated with a tooltip, not breaking row height.

9. **API keys** — list of keys (name, masked value like `hub_••••••••3f2a`, created/last-used
   dates). "+ Create API key" modal, then a one-time full-key reveal with copy button and a firm
   "you won't see this again" warning. A "Quick start" panel below with a short real Node.js sample
   calling the Hub SDK to run `orders.get`.

10. **Help center** — search bar plus three audience cards: "I approve or deny requests"
    (operations — links like "Understanding an approval request"), "I connect stores and manage
    agents" (admins — "Connecting WooCommerce," "Setting tool permissions"), "I'm integrating via
    API/SDK" (developers — "Authentication," "Handling require_approval responses"). A "Popular
    articles" list and a small corner support widget ("Still stuck? info@innov-ai-tive.de").
    Slightly warmer and more spacious than the rest of the app — this page is read, not scanned.

11. **Imprint** — plain single-column legal page (no hero, no cards), the company details above
    verbatim, "Responsible for content: Tobias Hartmann," and a short EU dispute-resolution
    paragraph. Deliberately unglamorous, calm generous line height.

12. **Privacy Policy** — same plain legal style as the Imprint, with a sticky left table of
    contents and sections: Data controller (same address), What we collect (account email,
    org/project membership, encrypted integration credentials, audit logs), Why we process it,
    Third parties (the commerce platforms an agent calls), Your GDPR rights, Contact.

Keep the Imprint and Privacy Policy content exactly as given — that's real legal text, not
placeholder copy to be replaced later.
