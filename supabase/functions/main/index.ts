/**
 * Router required by supabase/edge-runtime's --main-service mode: dispatches
 * /functions/v1/<name>/... to the matching function directory. Simplified from the official
 * Supabase docker template's default (drops its extra JWT pre-check, which imports `jose` from
 * JSR — unreachable in this environment, 403). Each of our own functions (mcp-server) already does
 * its own auth (see _shared/mcpAuth.ts), so this router doesn't need to duplicate that check.
 */
console.log("main function started");

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const serviceName = pathParts[1];

  if (!serviceName) {
    return new Response(JSON.stringify({ msg: "missing function name in request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const servicePath = `/home/deno/functions/${serviceName}`;

  const envVarsObj = Deno.env.toObject();
  const envVars = Object.keys(envVarsObj).map((k) => [k, envVarsObj[k]]);

  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: 150,
      workerTimeoutMs: 60 * 1000,
      noModuleCache: false,
      importMapPath: null,
      envVars,
    });
    return await worker.fetch(req);
  } catch (e) {
    return new Response(JSON.stringify({ msg: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
