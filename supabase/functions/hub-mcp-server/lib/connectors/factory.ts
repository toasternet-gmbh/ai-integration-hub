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
import { ContentfulConnector } from "./contentful.ts";
import { ClockifyConnector } from "./clockify.ts";
import { PrestaShopConnector } from "./prestashop.ts";
import { HubSpotConnector } from "./hubspot.ts";
import { PipedriveConnector } from "./pipedrive.ts";
import { MondayConnector } from "./monday.ts";
import { ClockinConnector } from "./clockin.ts";
import { ClockodoConnector } from "./clockodo.ts";
import { WeclappConnector } from "./weclapp.ts";
import { BillwerkConnector } from "./billwerk.ts";
import { PapershiftConnector } from "./papershift.ts";
import { Erfasst123Connector } from "./erfasst123.ts";
import { OpenHandwerkConnector } from "./openhandwerk.ts";
import { OutlookConnector } from "./outlook.ts";
import { GoogleConnector } from "./google.ts";
import { BrowserlessConnector } from "./browserless.ts";
import { MatrixConnector } from "./matrix.ts";
import { SteelConnector } from "./steel.ts";
import { SageConnector } from "./sage.ts";
import { OdooConnector } from "./odoo.ts";
import { QuickenConnector } from "./quicken.ts";
import { SalesforceConnector } from "./salesforce.ts";
import { ZendeskConnector } from "./zendesk.ts";
import { JiraConnector } from "./jira.ts";
import { NotionConnector } from "./notion.ts";
import { QuickBooksConnector } from "./quickbooks.ts";
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
      return new JtlConnector(creds as { clientId: string; clientSecret: string; tenantId: string });
    case "typo3": {
      const c = creds as { siteUrl: string; accessToken: string };
      assertPublicHttpUrl(c.siteUrl, "siteUrl");
      return new Typo3Connector(c);
    }
    case "contentful":
      return new ContentfulConnector(creds as { spaceId: string; accessToken: string; environmentId?: string; managementToken?: string });
    case "clockify":
      return new ClockifyConnector(creds as { workspaceId: string; apiKey: string });
    case "prestashop": {
      const c = creds as { storeUrl: string; accessToken: string };
      assertPublicHttpUrl(c.storeUrl, "storeUrl");
      return new PrestaShopConnector(c);
    }
    case "hubspot":
      return new HubSpotConnector(creds as { accessToken: string });
    case "pipedrive":
      return new PipedriveConnector(creds as { companyDomain: string; apiToken: string });
    case "monday":
      return new MondayConnector(creds as { apiToken: string; dealsBoardId: string; contactsBoardId?: string; companiesBoardId?: string; dealAmountColumnId?: string; dealStageColumnId?: string; contactEmailColumnId?: string });
    case "clockin":
      return new ClockinConnector(creds as { apiToken: string });
    case "clockodo":
      return new ClockodoConnector(creds as { email: string; apiKey: string });
    case "weclapp":
      return new WeclappConnector(creds as { tenant: string; apiToken: string });
    case "billwerk":
      return new BillwerkConnector(creds as { privateKey: string });
    case "papershift":
      return new PapershiftConnector(creds as { apiToken: string; interfaceLanguage?: string });
    case "123erfasst":
      return new Erfasst123Connector(creds as { clientId: string; clientSecret: string });
    case "openhandwerk":
      return new OpenHandwerkConnector(creds as { apiKey: string; accountId: string });
    case "outlook":
      return new OutlookConnector(creds as { accessToken: string; refreshToken: string; expiresAt: number });
    case "google":
      return new GoogleConnector(creds as { accessToken: string; refreshToken: string; expiresAt: number });
    case "browserless": {
      const c = creds as { apiKey: string; endpoint?: string };
      if (c.endpoint) assertPublicHttpUrl(c.endpoint, "endpoint");
      return new BrowserlessConnector(c);
    }
    case "beeper": {
      const c = creds as { homeserverUrl: string; accessToken: string };
      assertPublicHttpUrl(c.homeserverUrl, "homeserverUrl");
      return new MatrixConnector(c);
    }
    case "steel":
      return new SteelConnector(creds as { apiKey: string });
    case "sage":
      return new SageConnector(creds as { apiToken: string });
    case "odoo": {
      const c = creds as { url: string; db?: string; username?: string; apiKey: string };
      assertPublicHttpUrl(c.url, "url");
      return new OdooConnector(c);
    }
    case "quicken":
      return new QuickenConnector(creds as { apiToken: string });
    case "salesforce": {
      const c = creds as { instanceUrl: string; apiToken: string };
      assertPublicHttpUrl(c.instanceUrl, "instanceUrl");
      return new SalesforceConnector(c);
    }
    case "zendesk":
      return new ZendeskConnector(creds as { subdomain: string; email: string; apiToken: string });
    case "jira":
      return new JiraConnector(creds as { domain: string; email: string; apiToken: string });
    case "notion":
      return new NotionConnector(creds as { apiToken: string });
    case "quickbooks":
      return new QuickBooksConnector(creds as { apiToken: string });
    default:
      throw new Error(`No connector implemented for platform '${integration.platform}'.`);
  }
}
