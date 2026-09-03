/** Canonical invoices.* / contacts.* tools — dispatch to whichever connector the target
 *  integration_id belongs to. Same posture as products.ts: authorization already happened in
 *  index.ts before a handler here ever runs. */
import type { SupabaseAdmin, ToolDefinition, ToolModule } from "../lib/types.ts";
import { loadConnector } from "../lib/connectors/factory.ts";

async function requireIntegration(admin: SupabaseAdmin, projectId: string, integrationId: string) {
  const { data, error } = await admin
    .from("hub_integrations")
    .select("id, platform, credentials_encrypted, status")
    .eq("id", integrationId).eq("project_id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Integration ${integrationId} not found in this project`);
  if (data.status !== "connected") throw new Error(`Integration ${integrationId} is not connected (status: ${data.status})`);
  return data;
}

/** invoices.create/quotes.create/order_confirmations.create/delivery_notes.create/
 *  credit_notes.create all share this exact line-item shape (Lexoffice and sevDesk's sales-voucher
 *  resources are all built from the same underlying "line items with a name/qty/price/tax" model). */
const lineItemsSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["name", "quantity", "unit_price"],
    properties: {
      name: { type: "string" },
      quantity: { type: "number" },
      unit_price: { type: "number", description: "Net unit price." },
      tax_rate: { type: "number", description: "Percentage, e.g. 19. Defaults to 19." },
    },
  },
} as const;

/** Generates the definitions+handlers for one "sales document" domain (quotes/
 *  order_confirmations/delivery_notes) — all three are create/search/get with the exact same
 *  shape, just a different tool-name prefix and description. */
function salesDocumentModule(domain: string, docLabel: string): { definitions: ToolDefinition[]; handlers: ToolModule["handlers"] } {
  const idField = `${domain.replace(/s$/, "")}_id`;
  return {
    definitions: [
      {
        name: `${domain}.search`,
        description: `Search ${docLabel}s on a bookkeeping integration.`,
        inputSchema: {
          type: "object",
          required: ["integration_id"],
          properties: { integration_id: { type: "string" }, search: { type: "string" }, page: { type: "number" } },
        },
      },
      {
        name: `${domain}.get`,
        description: `Get one ${docLabel} by id.`,
        inputSchema: {
          type: "object",
          required: ["integration_id", idField],
          properties: { integration_id: { type: "string" }, [idField]: { type: "string" } },
        },
      },
      {
        name: `${domain}.create`,
        description: `Create a new ${docLabel} on a bookkeeping integration.`,
        inputSchema: {
          type: "object",
          required: ["integration_id", "contact_id", "line_items"],
          properties: {
            integration_id: { type: "string" },
            contact_id: { type: "string" },
            title: { type: "string" },
            line_items: lineItemsSchema,
          },
        },
      },
    ],
    handlers: {
      [`${domain}.search`]: async (args, { admin, projectId }) => {
        const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
        const connector = await loadConnector(integration);
        return (await connector.execute(`${domain}.search`, args)).data;
      },
      [`${domain}.get`]: async (args, { admin, projectId }) => {
        const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
        const connector = await loadConnector(integration);
        return (await connector.execute(`${domain}.get`, args)).data;
      },
      [`${domain}.create`]: async (args, { admin, projectId }) => {
        const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
        const connector = await loadConnector(integration);
        return (await connector.execute(`${domain}.create`, args)).data;
      },
    },
  };
}

const quotesModule = salesDocumentModule("quotes", "quotation");
const orderConfirmationsModule = salesDocumentModule("order_confirmations", "order confirmation");
const deliveryNotesModule = salesDocumentModule("delivery_notes", "delivery note");

export const definitions: ToolDefinition[] = [
  {
    name: "invoices.search",
    description: "Search invoices on a bookkeeping integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: {
        integration_id: { type: "string" },
        search: { type: "string" },
        status: { type: "string", description: "e.g. open, paid, voided, draft" },
        page: { type: "number" },
      },
    },
  },
  {
    name: "invoices.get",
    description: "Get one invoice by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "invoice_id"],
      properties: { integration_id: { type: "string" }, invoice_id: { type: "string" } },
    },
  },
  {
    name: "contacts.search",
    description: "Search contacts (customers/vendors/leads) on a bookkeeping or CRM integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" }, name: { type: "string" }, email: { type: "string" }, page: { type: "number" } },
    },
  },
  {
    name: "contacts.get",
    description: "Get one contact by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "contact_id"],
      properties: { integration_id: { type: "string" }, contact_id: { type: "string" } },
    },
  },
  {
    name: "contacts.create",
    description: "Create a new contact (customer or vendor) on a bookkeeping integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "name"],
      properties: {
        integration_id: { type: "string" },
        name: { type: "string", description: "Company name, or full person name." },
        email: { type: "string" },
      },
    },
  },
  {
    name: "invoices.create",
    description: "Create a new invoice on a bookkeeping integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "contact_id", "line_items"],
      properties: {
        integration_id: { type: "string" },
        contact_id: { type: "string" },
        title: { type: "string" },
        line_items: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "quantity", "unit_price"],
            properties: {
              name: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number", description: "Net unit price." },
              tax_rate: { type: "number", description: "Percentage, e.g. 19. Defaults to 19." },
            },
          },
        },
      },
    },
  },
  {
    name: "invoices.finalize",
    description: "Finalize a draft invoice, assigning it a real invoice number (sevDesk only — Lexoffice has no API to change an invoice's status after creation).",
    inputSchema: {
      type: "object",
      required: ["integration_id", "invoice_id"],
      properties: {
        integration_id: { type: "string" }, invoice_id: { type: "string" },
        send_type: { type: "string", description: "How the invoice was delivered: VPR (print), VP (post), VM (mail), or VPDF (downloaded PDF). Defaults to VPR." },
      },
    },
  },
  {
    name: "invoices.record_payment",
    description: "Record a payment against an invoice (sevDesk only).",
    inputSchema: {
      type: "object",
      required: ["integration_id", "invoice_id", "amount", "check_account_id"],
      properties: {
        integration_id: { type: "string" }, invoice_id: { type: "string" },
        amount: { type: "number" },
        check_account_id: { type: "string", description: "The sevDesk bank/cash account (CheckAccount) the payment was received into." },
        date: { type: "string", description: "ISO 8601 date. Defaults to now." },
      },
    },
  },
  {
    name: "invoices.void",
    description: "Cancel an invoice, creating a reversing cancellation invoice (sevDesk only).",
    inputSchema: {
      type: "object",
      required: ["integration_id", "invoice_id"],
      properties: { integration_id: { type: "string" }, invoice_id: { type: "string" } },
    },
  },
  {
    name: "contacts.update",
    description: "Update an existing contact (customer or vendor) on a bookkeeping integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "contact_id"],
      properties: {
        integration_id: { type: "string" }, contact_id: { type: "string" },
        name: { type: "string" }, email: { type: "string" },
      },
    },
  },
  {
    name: "vouchers.create_from_file",
    description: "Book an expense by uploading a receipt or bill (image or PDF) as a voucher on a bookkeeping integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "file_base64", "file_name"],
      properties: {
        integration_id: { type: "string" },
        file_base64: { type: "string", description: "Base64-encoded file content (image or PDF)." },
        file_name: { type: "string", description: "e.g. receipt.jpg" },
        mime_type: { type: "string", description: "e.g. image/jpeg, application/pdf. Defaults to image/jpeg." },
        description: { type: "string" },
      },
    },
  },
  ...quotesModule.definitions,
  ...orderConfirmationsModule.definitions,
  ...deliveryNotesModule.definitions,
  {
    name: "credit_notes.search",
    description: "Search credit notes on a bookkeeping integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" }, search: { type: "string" }, page: { type: "number" } },
    },
  },
  {
    name: "credit_notes.get",
    description: "Get one credit note by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "credit_note_id"],
      properties: { integration_id: { type: "string" }, credit_note_id: { type: "string" } },
    },
  },
  {
    name: "credit_notes.create",
    description: "Create a credit note — either reversing a specific invoice (preceding_invoice_id) or standalone from line items.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "contact_id"],
      properties: {
        integration_id: { type: "string" },
        contact_id: { type: "string" },
        title: { type: "string" },
        preceding_invoice_id: { type: "string", description: "Reverses this invoice's line items instead of using line_items." },
        line_items: lineItemsSchema,
      },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "invoices.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("invoices.search", args)).data;
  },

  async "invoices.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("invoices.get", args)).data;
  },

  async "contacts.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("contacts.search", args)).data;
  },

  async "contacts.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("contacts.get", args)).data;
  },

  async "contacts.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("contacts.create", args)).data;
  },

  async "invoices.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("invoices.create", args)).data;
  },

  async "invoices.finalize"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("invoices.finalize", args)).data;
  },

  async "invoices.record_payment"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("invoices.record_payment", args)).data;
  },

  async "invoices.void"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("invoices.void", args)).data;
  },

  async "contacts.update"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("contacts.update", args)).data;
  },

  async "vouchers.create_from_file"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("vouchers.create_from_file", args)).data;
  },

  ...quotesModule.handlers,
  ...orderConfirmationsModule.handlers,
  ...deliveryNotesModule.handlers,

  async "credit_notes.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("credit_notes.search", args)).data;
  },

  async "credit_notes.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("credit_notes.get", args)).data;
  },

  async "credit_notes.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("credit_notes.create", args)).data;
  },
};
