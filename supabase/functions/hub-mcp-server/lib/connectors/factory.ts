import type { Connector } from "./types.ts";
import { WooCommerceConnector } from "./woocommerce.ts";
import { ShopwareConnector } from "./shopware.ts";
import { ShopifyConnector } from "./shopify.ts";
import { MagentoConnector } from "./magento.ts";
import { LexofficeConnector } from "./lexoffice.ts";
import { WordPressConnector } from "./wordpress.ts";
import { TogglConnector } from "./toggl.ts";
import { GoCardlessConnector } from "./gocardless.ts";
import { SevdeskConnector } from "./sevdesk.ts";
import { PersonioConnector } from "./personio.ts";
import { DatevConnector } from "./datev.ts";
import { JtlConnector } from "./jtl.ts";
import { Typo3Connector } from "./typo3.ts";
import { decryptCredentials } from "../crypto.ts";
import { assertPublicHttpUrl } from "../urlGuard.ts";

/** Loads an integration row's encrypted credentials and returns the right Connector for its platform. */
export async function loadConnector(integration: { platform: string; credentials_encrypted: string }): Promise<Connector> {
  const creds = await decryptCredentials(integration.credentials_encrypted);
  switch (integration.platform) {
    case "woocommerce": {
      const c = creds as { storeUrl: string; consumerKey: string; consumerSecret: string };
      assertPublicHttpUrl(c.storeUrl, "storeUrl");
      return new WooCommerceConnector(c);
    }
    case "shopware": {
      const c = creds as { storeUrl: string; clientId: string; clientSecret: string };
      assertPublicHttpUrl(c.storeUrl, "storeUrl");
      return new ShopwareConnector(c);
    }
    case "shopify": {
      const c = creds as { storeUrl: string; accessToken: string };
      assertPublicHttpUrl(c.storeUrl, "storeUrl");
      return new ShopifyConnector(c);
    }
    case "magento": {
      const c = creds as { storeUrl: string; accessToken: string };
      assertPublicHttpUrl(c.storeUrl, "storeUrl");
      return new MagentoConnector(c);
    }
    case "lexoffice":
      return new LexofficeConnector(creds as { apiKey: string });
    case "wordpress": {
      const c = creds as { siteUrl: string; username: string; appPassword: string };
      assertPublicHttpUrl(c.siteUrl, "siteUrl");
      return new WordPressConnector(c);
    }
    case "toggl":
      return new TogglConnector(creds as { apiToken: string });
    case "gocardless":
      return new GoCardlessConnector(creds as { requisitionId: string; accountIds: string[] });
    case "sevdesk":
      return new SevdeskConnector(creds as { apiKey: string });
    case "personio":
      return new PersonioConnector(creds as { clientId: string; clientSecret: string });
    case "datev":
      return new DatevConnector(creds as { clientId: string; clientSecret: string });
    case "jtl":
      return new JtlConnector(creds as { clientId: string; clientSecret: string });
    case "typo3": {
      const c = creds as { siteUrl: string; accessToken: string };
      assertPublicHttpUrl(c.siteUrl, "siteUrl");
      return new Typo3Connector(c);
    }
    default:
      throw new Error(`No connector implemented for platform '${integration.platform}'.`);
  }
}
