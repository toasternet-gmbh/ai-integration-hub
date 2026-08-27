import { describe, expect, it, vi } from "vitest";
import { HubApiError, HubClient, isApprovalRequired } from "../index.js";

function jsonRpcResponse(result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function toolContentResult(value: unknown, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value) }], isError };
}

describe("HubClient construction", () => {
  it("throws without apiKey", () => {
    // @ts-expect-error intentionally omitting required field
    expect(() => new HubClient({ baseUrl: "https://hub.example.com/mcp" })).toThrow(/apiKey/);
  });

  it("throws without baseUrl", () => {
    // @ts-expect-error intentionally omitting required field
    expect(() => new HubClient({ apiKey: "hub_test" })).toThrow(/baseUrl/);
  });
});

describe("HubClient.call", () => {
  it("posts a JSON-RPC 2.0 tools/call request with Bearer auth and parses the text result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRpcResponse(toolContentResult([{ id: "ORD-1" }])));
    const client = new HubClient({ apiKey: "hub_test123", baseUrl: "https://hub.example.com/mcp", fetch: fetchMock as any });

    const result = await client.call("orders.search", { integration_id: "int-1" });

    expect(result).toEqual([{ id: "ORD-1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hub.example.com/mcp");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer hub_test123");
    expect(init.headers["X-Agent-Id"]).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.method).toBe("tools/call");
    expect(body.params).toEqual({ name: "orders.search", arguments: { integration_id: "int-1" } });
  });

  it("sends X-Agent-Id from the client default, overridable per call", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonRpcResponse(toolContentResult({ ok: true }))));
    const client = new HubClient({ apiKey: "hub_test", baseUrl: "https://hub.example.com/mcp", agentId: "agent-default", fetch: fetchMock as any });

    await client.call("orders.get", { integration_id: "i", order_id: "o" });
    expect(fetchMock.mock.calls[0][1].headers["X-Agent-Id"]).toBe("agent-default");

    await client.call("orders.get", { integration_id: "i", order_id: "o" }, { agentId: "agent-override" });
    expect(fetchMock.mock.calls[1][1].headers["X-Agent-Id"]).toBe("agent-override");
  });

  it("throws HubApiError on a JSON-RPC error envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Unknown tool" } }), { status: 200 }),
    );
    const client = new HubClient({ apiKey: "hub_test", baseUrl: "https://hub.example.com/mcp", fetch: fetchMock as any });

    await expect(client.call("not.a.tool", {})).rejects.toThrow(/Unknown tool/);
  });

  it("throws HubApiError when the tool result is isError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRpcResponse(toolContentResult("Integration is not connected", true)));
    const client = new HubClient({ apiKey: "hub_test", baseUrl: "https://hub.example.com/mcp", fetch: fetchMock as any });

    const err = await client.call("orders.get", { integration_id: "i", order_id: "o" }).catch((e) => e);
    expect(err).toBeInstanceOf(HubApiError);
    expect((err as HubApiError).message).toBe("Integration is not connected");
    expect((err as HubApiError).toolName).toBe("orders.get");
  });

  it("throws HubApiError on a non-OK HTTP response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Invalid API key" } }), { status: 401 }),
    );
    const client = new HubClient({ apiKey: "hub_bad", baseUrl: "https://hub.example.com/mcp", fetch: fetchMock as any });

    await expect(client.call("orders.search", {})).rejects.toThrow(/Invalid API key/);
  });

  it("passes through an approval_required result without throwing", async () => {
    const approval = { approval_required: true, approval_id: "appr-1" };
    const fetchMock = vi.fn().mockResolvedValue(jsonRpcResponse(toolContentResult(approval)));
    const client = new HubClient({ apiKey: "hub_test", baseUrl: "https://hub.example.com/mcp", fetch: fetchMock as any });

    const result = await client.call("orders.refund", { integration_id: "i", order_id: "o" });
    expect(isApprovalRequired(result)).toBe(true);
    expect(result).toEqual(approval);
  });
});

describe("HubClient.tools proxy", () => {
  it("maps a two-level path to the matching dotted tool name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRpcResponse(toolContentResult([])));
    const client = new HubClient({ apiKey: "hub_test", baseUrl: "https://hub.example.com/mcp", fetch: fetchMock as any });

    await client.tools.orders.search({ integration_id: "int-1", limit: 10 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.params.name).toBe("orders.search");
    expect(body.params.arguments).toEqual({ integration_id: "int-1", limit: 10 });
  });

  it("maps a three-level path (nested domain) to the matching dotted tool name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRpcResponse(toolContentResult([])));
    const client = new HubClient({ apiKey: "hub_test", baseUrl: "https://hub.example.com/mcp", fetch: fetchMock as any });

    await client.tools.cms.pages.search({ integration_id: "int-1" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.params.name).toBe("cms.pages.search");
  });

  it("supports tool names this SDK version has no typed shortcut for", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRpcResponse(toolContentResult({ ok: true })));
    const client = new HubClient({ apiKey: "hub_test", baseUrl: "https://hub.example.com/mcp", fetch: fetchMock as any });

    await (client.tools as any).some.brand_new.tool({ x: 1 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.params.name).toBe("some.brand_new.tool");
  });
});
