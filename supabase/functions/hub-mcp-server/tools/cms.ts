/** Canonical cms.pages.* tools — dispatch to whichever connector the target integration_id
 *  belongs to. Same posture as bookkeeping.ts: authorization already happened in index.ts before
 *  a handler here ever runs. */
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

export const definitions: ToolDefinition[] = [
  {
    name: "cms.pages.search",
    description: "Search pages on a CMS integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: {
        integration_id: { type: "string" },
        search: { type: "string" },
        status: { type: "string", description: "e.g. publish, draft, private" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "cms.pages.get",
    description: "Get one page by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "page_id"],
      properties: { integration_id: { type: "string" }, page_id: { type: "string" } },
    },
  },
  {
    name: "cms.pages.create",
    description: "Create a new content entry on a CMS integration. On Contentful, this creates an entry of the given content type from raw field values.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "content_type_id", "fields"],
      properties: {
        integration_id: { type: "string" },
        content_type_id: { type: "string", description: "The Contentful content type id to create an entry of." },
        fields: { type: "object", description: "Field id -> plain value (not locale-wrapped)." },
        publish: { type: "boolean", description: "Publish immediately. Defaults to false (draft only)." },
      },
    },
  },
  {
    name: "cms.posts.search",
    description: "Search blog posts on a CMS integration (distinct from static pages).",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: {
        integration_id: { type: "string" },
        search: { type: "string" },
        status: { type: "string", description: "e.g. publish, draft, private" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "cms.posts.get",
    description: "Get one blog post by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "post_id"],
      properties: { integration_id: { type: "string" }, post_id: { type: "string" } },
    },
  },
  {
    name: "cms.posts.create",
    description: "Create a new blog post on a CMS integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "title", "content"],
      properties: {
        integration_id: { type: "string" },
        title: { type: "string" },
        content: { type: "string", description: "HTML content." },
        status: { type: "string", description: "publish, draft, pending, or private. Defaults to draft." },
      },
    },
  },
  {
    name: "cms.posts.update",
    description: "Update an existing blog post on a CMS integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "post_id"],
      properties: {
        integration_id: { type: "string" }, post_id: { type: "string" },
        title: { type: "string" }, content: { type: "string" }, status: { type: "string" },
      },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "cms.pages.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.pages.search", args)).data;
  },

  async "cms.pages.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.pages.get", args)).data;
  },

  async "cms.pages.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.pages.create", args)).data;
  },

  async "cms.posts.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.posts.search", args)).data;
  },

  async "cms.posts.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.posts.get", args)).data;
  },

  async "cms.posts.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.posts.create", args)).data;
  },

  async "cms.posts.update"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.posts.update", args)).data;
  },
};
