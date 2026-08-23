import type { Connector } from "./types.ts";
import { WooCommerceConnector } from "./woocommerce.ts";
import { decryptCredentials } from "../crypto.ts";

/** Loads an integration row's encrypted credentials and returns the right Connector for its platform. */
export async function loadConnector(integration: { platform: string; credentials_encrypted: string }): Promise<Connector> {
  const creds = await decryptCredentials(integration.credentials_encrypted);
  switch (integration.platform) {
    case "woocommerce":
      return new WooCommerceConnector(creds as { storeUrl: string; consumerKey: string; consumerSecret: string });
    default:
      throw new Error(`No connector implemented for platform '${integration.platform}'.`);
  }
}
