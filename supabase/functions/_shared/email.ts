/** Shared Resend email sender, used by hub-mcp-server's approval-pending notification. */
export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email is not configured: RESEND_API_KEY is not set.");
    this.name = "EmailNotConfiguredError";
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<{ id: string } | null> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) throw new EmailNotConfiguredError();

  const fromName = Deno.env.get("EMAIL_FROM_NAME") || "AI Integration Hub";
  const fromAddress = Deno.env.get("EMAIL_FROM") || "noreply@example.com";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${fromName} <${fromAddress}>`, to: [to], subject, html }),
  });
  if (!response.ok) throw new Error(`Failed to send email: ${await response.text()}`);
  return await response.json();
}
