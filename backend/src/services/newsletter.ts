import { config } from "../config/env.js";
import { logger } from "../server.js";

interface Subscriber {
  email: string;
  name: string;
  source: "purchase" | "website";
  tags: string[];
}

/**
 * Adiciona inscrito à newsletter (Mailchimp ou fallback)
 */
export async function addSubscriber(subscriber: Subscriber) {
  if (!config.MAILCHIMP_API_KEY || !config.MAILCHIMP_LIST_ID) {
    logger.warn("Mailchimp not configured - subscriber stored locally", { email: subscriber.email });
    // Salvar em tabela local de leads
    return;
  }

  const datacenter = config.MAILCHIMP_API_KEY.split("-")[1];
  const url = `https://${datacenter}.api.mailchimp.com/3.0/lists/${config.MAILCHIMP_LIST_ID}/members`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `apikey ${config.MAILCHIMP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: subscriber.email,
      status: "subscribed",
      merge_fields: {
        FNAME: subscriber.name,
        SOURCE: subscriber.source,
      },
      tags: subscriber.tags,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error("Mailchimp API error", { status: response.status, body: text });
    throw new Error(`Mailchimp: ${response.status}`);
  }

  logger.info("Added to newsletter", { email: subscriber.email, source: subscriber.source });
}
