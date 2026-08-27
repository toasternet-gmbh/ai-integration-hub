/** Official client for the AI Integration Hub's MCP gateway (`hub-mcp-server`) — a JSON-RPC 2.0
 *  endpoint over HTTPS. This client authenticates with a project-scoped API key (from the Hub
 *  console's API Keys page) and exposes both a generic `call(name, input)` and a typed, dot-path
 *  fluent shortcut (`client.tools.orders.get(...)`) for the canonical tools this version of the
 *  SDK knows about. The fluent shortcut works for ANY tool name, including ones added to the Hub
 *  after this SDK version shipped — it isn't limited to the typed `ToolsNamespace` shape below. */

/** Returned instead of a tool's normal result when the calling agent's policy for that tool is
 *  "Require approval" — the action has NOT run yet. See the Hub's Help Center article "Handling a
 *  require_approval response" for the recommended pattern: tell the caller/end user it's pending,
 *  then stop. Poll `list_approvals` for this `approval_id` if you need to know the outcome. */
export interface ApprovalRequired {
  approval_required: true;
  approval_id: string;
}

export type ToolResult<T = unknown> = T | ApprovalRequired;

export function isApprovalRequired(result: unknown): result is ApprovalRequired {
  return typeof result === "object" && result !== null && (result as Record<string, unknown>).approval_required === true;
}

/** Thrown for both JSON-RPC-level errors (bad auth, unknown tool, ...) and tool-execution errors
 *  (the underlying platform — e.g. WooCommerce, Lexoffice — rejected the call). `toolName` is set
 *  whenever the error happened while calling a specific tool. */
export class HubApiError extends Error {
  readonly toolName?: string;

  constructor(message: string, toolName?: string) {
    super(message);
    this.name = "HubApiError";
    this.toolName = toolName;
  }
}

export interface HubClientOptions {
  /** Project-scoped API key from the Hub console's API Keys page (starts with `hub_`). */
  apiKey: string;
  /** The Hub's MCP gateway URL, e.g. `https://<project>.supabase.co/functions/v1/hub-mcp-server`.
   *  Ask your Hub admin, or check the API Keys page's Quick Start panel. */
  baseUrl: string;
  /** Default `X-Agent-Id` sent with every call — required by tool domains that record which agent
   *  acted (orders.*, invoices.*, ...). Override per call via the second argument to `call()` or
   *  any `client.tools.*` method. */
  agentId?: string;
  /** Override the fetch implementation (e.g. for tests, or a runtime with no global fetch).
   *  Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
}

export interface CallOptions {
  /** Overrides the client-level default agentId for this one call. */
  agentId?: string;
}

// ---- canonical tool input shapes -----------------------------------------------------------
// Mirrors supabase/functions/hub-mcp-server/tools/*.ts's inputSchema definitions exactly. Result
// types are intentionally `unknown` — the shape is whatever the underlying platform returns,
// passed through close to as-is; the Hub does not normalize response bodies, only inputs.

export interface OrdersSearchInput { integration_id: string; status?: string; limit?: number }
export interface OrdersGetInput { integration_id: string; order_id: string }
export interface OrdersRefundInput { integration_id: string; order_id: string; amount?: number; reason?: string }

export interface ProductsSearchInput { integration_id: string; search?: string; limit?: number }
export interface ProductsGetInput { integration_id: string; product_id: string }
export interface ProductsUpdatePriceInput { integration_id: string; product_id: string; price: number }

export interface InventoryGetStockInput { integration_id: string; product_id: string }
export interface InventoryUpdateStockInput { integration_id: string; product_id: string; quantity: number }

export interface InvoicesSearchInput { integration_id: string; search?: string; status?: string; page?: number }
export interface InvoicesGetInput { integration_id: string; invoice_id: string }
export interface ContactsSearchInput { integration_id: string; name?: string; email?: string; page?: number }

export interface CmsPagesSearchInput { integration_id: string; search?: string; status?: string; limit?: number }
export interface CmsPagesGetInput { integration_id: string; page_id: string }

export interface TimeEntriesSearchInput { integration_id: string; start_date?: string; end_date?: string }
export interface TimeEntriesGetInput { integration_id: string; time_entry_id: string }

export interface AccountsListInput { integration_id: string }
export interface TransactionsSearchInput { integration_id: string; account_id?: string; date_from?: string; date_to?: string }

/** Typed dot-path shortcuts for every canonical tool this SDK version was built against. */
export interface ToolsNamespace {
  orders: {
    search(input: OrdersSearchInput, opts?: CallOptions): Promise<ToolResult<unknown[]>>;
    get(input: OrdersGetInput, opts?: CallOptions): Promise<ToolResult<unknown>>;
    refund(input: OrdersRefundInput, opts?: CallOptions): Promise<ToolResult<unknown>>;
  };
  products: {
    search(input: ProductsSearchInput, opts?: CallOptions): Promise<ToolResult<unknown[]>>;
    get(input: ProductsGetInput, opts?: CallOptions): Promise<ToolResult<unknown>>;
    update_price(input: ProductsUpdatePriceInput, opts?: CallOptions): Promise<ToolResult<unknown>>;
  };
  inventory: {
    get_stock(input: InventoryGetStockInput, opts?: CallOptions): Promise<ToolResult<unknown>>;
    update_stock(input: InventoryUpdateStockInput, opts?: CallOptions): Promise<ToolResult<unknown>>;
  };
  invoices: {
    search(input: InvoicesSearchInput, opts?: CallOptions): Promise<ToolResult<unknown[]>>;
    get(input: InvoicesGetInput, opts?: CallOptions): Promise<ToolResult<unknown>>;
  };
  contacts: {
    search(input: ContactsSearchInput, opts?: CallOptions): Promise<ToolResult<unknown[]>>;
  };
  cms: {
    pages: {
      search(input: CmsPagesSearchInput, opts?: CallOptions): Promise<ToolResult<unknown[]>>;
      get(input: CmsPagesGetInput, opts?: CallOptions): Promise<ToolResult<unknown>>;
    };
  };
  time_entries: {
    search(input: TimeEntriesSearchInput, opts?: CallOptions): Promise<ToolResult<unknown[]>>;
    get(input: TimeEntriesGetInput, opts?: CallOptions): Promise<ToolResult<unknown>>;
  };
  accounts: {
    list(input: AccountsListInput, opts?: CallOptions): Promise<ToolResult<unknown[]>>;
  };
  transactions: {
    search(input: TransactionsSearchInput, opts?: CallOptions): Promise<ToolResult<unknown[]>>;
  };
}

/** `client.tools` also accepts any dot-path not in `ToolsNamespace` above (new tools the Hub adds
 *  after this SDK version), via the same Proxy — just without static typing for that call. */
type LooseToolsNamespace = ToolsNamespace & Record<string, unknown>;

let requestId = 0;

export class HubClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly agentId?: string;
  private readonly fetchImpl: typeof fetch;

  /** Dot-path fluent access, e.g. `client.tools.orders.get({...})` or
   *  `client.tools.cms.pages.search({...})` — equivalent to `client.call("orders.get", {...})`. */
  readonly tools: LooseToolsNamespace;

  constructor(options: HubClientOptions) {
    if (!options.apiKey) throw new Error("HubClient: options.apiKey is required");
    if (!options.baseUrl) {
      throw new Error(
        "HubClient: options.baseUrl is required — this is your Hub's MCP gateway URL, " +
          "e.g. https://<project>.supabase.co/functions/v1/hub-mcp-server (see the API Keys page).",
      );
    }
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.agentId = options.agentId;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error("HubClient: no global fetch available on this runtime — pass options.fetch explicitly");
    }
    this.tools = buildToolProxy((name, input, opts) => this.call(name, input, opts)) as LooseToolsNamespace;
  }

  /** Calls any canonical tool by its full dot-path name (e.g. "orders.refund",
   *  "cms.pages.search"). Use this directly for a tool this SDK version has no typed shortcut for
   *  yet — it's exactly what every `client.tools.*` shortcut calls under the hood. */
  async call<T = unknown>(name: string, input: Record<string, unknown> = {}, opts: CallOptions = {}): Promise<ToolResult<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
    const agentId = opts.agentId ?? this.agentId;
    if (agentId) headers["X-Agent-Id"] = agentId;

    const res = await this.fetchImpl(this.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++requestId,
        method: "tools/call",
        params: { name, arguments: input },
      }),
    });

    const json: Record<string, any> | null = await res.json().catch(() => null);
    if (!res.ok) throw new HubApiError(json?.error?.message ?? json?.msg ?? `HTTP ${res.status}`, name);
    if (!json) throw new HubApiError(`HTTP ${res.status}: empty response`, name);
    if (json.error) throw new HubApiError(json.error.message, name);

    const text: string | undefined = json.result?.content?.[0]?.text;
    const parsed = text !== undefined ? safeParse(text) : json.result;
    if (json.result?.isError) {
      throw new HubApiError(typeof parsed === "string" ? parsed : (text ?? "Tool error"), name);
    }
    return parsed as ToolResult<T>;
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildToolProxy(
  call: (name: string, input?: Record<string, unknown>, opts?: CallOptions) => Promise<unknown>,
  path: string[] = [],
): unknown {
  const target = () => {};
  return new Proxy(target, {
    get(_t, prop) {
      if (typeof prop !== "string") return undefined;
      return buildToolProxy(call, [...path, prop]);
    },
    apply(_t, _thisArg, args) {
      return call(path.join("."), args[0] as Record<string, unknown> | undefined, args[1] as CallOptions | undefined);
    },
  });
}
