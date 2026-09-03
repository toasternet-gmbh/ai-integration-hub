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
    name: "cms.pages.update",
    description: "Update an existing content entry on a CMS integration. On Contentful, updates field values on an existing entry.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "page_id", "fields"],
      properties: {
        integration_id: { type: "string" },
        page_id: { type: "string" },
        fields: { type: "object", description: "Field id -> plain value (not locale-wrapped). Only the fields given are changed." },
        publish: { type: "boolean", description: "Publish immediately after updating. Defaults to false." },
      },
    },
  },
  {
    name: "cms.media.search",
    description: "Search media/attachments on a CMS integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" }, search: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "cms.media.get",
    description: "Get one media item by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "media_id"],
      properties: { integration_id: { type: "string" }, media_id: { type: "string" } },
    },
  },
  {
    name: "cms.media.create",
    description: "Upload a media file (image or other) to a CMS integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "file_base64", "file_name"],
      properties: {
        integration_id: { type: "string" },
        file_base64: { type: "string", description: "Base64-encoded file content." },
        file_name: { type: "string", description: "e.g. photo.jpg" },
        mime_type: { type: "string", description: "e.g. image/jpeg. Defaults to image/jpeg." },
      },
    },
  },
  {
    name: "cms.comments.search",
    description: "Search comments on a CMS integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: {
        integration_id: { type: "string" },
        status: { type: "string", description: "e.g. approve, hold, spam, trash" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "cms.comments.get",
    description: "Get one comment by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "comment_id"],
      properties: { integration_id: { type: "string" }, comment_id: { type: "string" } },
    },
  },
  {
    name: "cms.comments.update",
    description: "Moderate a comment (change its status, e.g. to approve, spam, or trash it).",
    inputSchema: {
      type: "object",
      required: ["integration_id", "comment_id", "status"],
      properties: {
        integration_id: { type: "string" }, comment_id: { type: "string" },
        status: { type: "string", description: "approve, hold, spam, or trash." },
      },
    },
  },
  {
    name: "cms.assets.search",
    description: "Search media assets on a CMS integration (Contentful: images/files, distinct from entries).",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" }, search: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "cms.assets.get",
    description: "Get one media asset by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "asset_id"],
      properties: { integration_id: { type: "string" }, asset_id: { type: "string" } },
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

  async "cms.pages.update"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.pages.update", args)).data;
  },

  async "cms.media.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.media.search", args)).data;
  },

  async "cms.media.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.media.get", args)).data;
  },

  async "cms.media.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.media.create", args)).data;
  },

  async "cms.comments.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.comments.search", args)).data;
  },

  async "cms.comments.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.comments.get", args)).data;
  },

  async "cms.comments.update"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.comments.update", args)).data;
  },

  async "cms.assets.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.assets.search", args)).data;
  },

  async "cms.assets.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.assets.get", args)).data;
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
