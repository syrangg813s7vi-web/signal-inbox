import { XMLParser } from "fast-xml-parser";

const rssParser = new XMLParser({
  attributeNamePrefix: "",
  cdataPropName: "__cdata",
  ignoreAttributes: false,
  parseTagValue: false,
  textNodeName: "#text",
  trimValues: true,
});

export interface RssConnectorSource {
  id: string;
  name: string;
  sourceUrl: string;
}

export interface RssFeedMetadata {
  title: string | null;
  description: string | null;
  siteUrl: string | null;
  generator: string | null;
  language: string | null;
}

export interface RssFeedAsset {
  externalId: string | null;
  title: string | null;
  author: string | null;
  url: string | null;
  publishedAt: Date | null;
  rawContent: string | null;
  rawMetadata: Record<string, unknown>;
}

export interface RssFeedFetchResult {
  sourceId: string;
  sourceUrl: string;
  finalUrl: string;
  requestedAt: Date;
  metadata: RssFeedMetadata;
  items: RssFeedAsset[];
}

export class RssConnectorError extends Error {
  constructor(
    message: string,
    readonly details: {
      sourceId: string;
      sourceUrl: string;
      statusCode?: number;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "RssConnectorError";
    this.cause = details.cause;
  }

  declare cause?: unknown;
}

export async function fetchRssFeed(source: RssConnectorSource): Promise<RssFeedFetchResult> {
  const requestedAt = new Date();

  let response: Response;

  try {
    response = await fetch(source.sourceUrl, {
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
        "user-agent": "SignalInboxRSSConnector/0.1",
      },
      redirect: "follow",
    });
  } catch (error) {
    throw new RssConnectorError(`RSS fetch failed for source ${source.id}.`, {
      cause: error,
      sourceId: source.id,
      sourceUrl: source.sourceUrl,
    });
  }

  if (!response.ok) {
    throw new RssConnectorError(
      `RSS fetch failed for source ${source.id} with status ${response.status}.`,
      {
        sourceId: source.id,
        sourceUrl: source.sourceUrl,
        statusCode: response.status,
      },
    );
  }

  const xml = await response.text();
  const parsedFeed = parseFeedXml(xml, source);

  return {
    finalUrl: response.url || source.sourceUrl,
    items: parsedFeed.items,
    metadata: parsedFeed.metadata,
    requestedAt,
    sourceId: source.id,
    sourceUrl: source.sourceUrl,
  };
}

function parseFeedXml(xml: string, source: RssConnectorSource) {
  let parsed: unknown;

  try {
    parsed = rssParser.parse(xml);
  } catch (error) {
    throw new RssConnectorError(`RSS parsing failed for source ${source.id}.`, {
      cause: error,
      sourceId: source.id,
      sourceUrl: source.sourceUrl,
    });
  }

  if (!parsed || typeof parsed !== "object") {
    throw new RssConnectorError(`RSS parsing returned no document for source ${source.id}.`, {
      sourceId: source.id,
      sourceUrl: source.sourceUrl,
    });
  }

  const documentRecord = parsed as Record<string, unknown>;

  if (documentRecord.rss && typeof documentRecord.rss === "object") {
    return parseRssDocument(documentRecord.rss as Record<string, unknown>, source);
  }

  if (documentRecord.feed && typeof documentRecord.feed === "object") {
    return parseAtomDocument(documentRecord.feed as Record<string, unknown>, source);
  }

  throw new RssConnectorError(`Unsupported RSS document shape for source ${source.id}.`, {
    sourceId: source.id,
    sourceUrl: source.sourceUrl,
  });
}

function parseRssDocument(rss: Record<string, unknown>, source: RssConnectorSource) {
  const channel = asRecord(rss.channel);

  if (!channel) {
    throw new RssConnectorError(`RSS channel is missing for source ${source.id}.`, {
      sourceId: source.id,
      sourceUrl: source.sourceUrl,
    });
  }

  const items = asArray(channel.item).map((item) => mapRssItem(asRecord(item))).filter(isDefined);

  return {
    items,
    metadata: {
      description: readText(channel.description),
      generator: readText(channel.generator),
      language: readText(channel.language),
      siteUrl: readUrl(channel.link),
      title: readText(channel.title),
    } satisfies RssFeedMetadata,
  };
}

function parseAtomDocument(feed: Record<string, unknown>, source: RssConnectorSource) {
  const entries = asArray(feed.entry).map((entry) => mapAtomEntry(asRecord(entry))).filter(isDefined);

  return {
    items: entries,
    metadata: {
      description: readText(feed.subtitle),
      generator: readText(feed.generator),
      language: readText(feed["xml:lang"]),
      siteUrl: readAtomLink(feed.link),
      title: readText(feed.title),
    } satisfies RssFeedMetadata,
  };
}

function mapRssItem(item: Record<string, unknown> | null): RssFeedAsset | undefined {
  if (!item) {
    return undefined;
  }

  const url = readUrl(item.link);
  const externalId = firstNonEmpty([
    readText(item.guid),
    readText(item.id),
    url,
  ]);

  return {
    author: firstNonEmpty([readText(item["dc:creator"]), readText(item.author), readText(item.creator)]),
    externalId,
    publishedAt: parseDate(
      firstNonEmpty([
        readText(item.pubDate),
        readText(item.isoDate),
        readText(item.published),
        readText(item.updated),
      ]),
    ),
    rawContent: firstNonEmpty([
      readText(item["content:encoded"]),
      readText(item.description),
      readText(item.content),
    ]),
    rawMetadata: sanitizeMetadata(item),
    title: readText(item.title),
    url,
  };
}

function mapAtomEntry(entry: Record<string, unknown> | null): RssFeedAsset | undefined {
  if (!entry) {
    return undefined;
  }

  const url = readAtomLink(entry.link);
  const externalId = firstNonEmpty([readText(entry.id), url]);
  const author = asRecord(entry.author);

  return {
    author: firstNonEmpty([readText(author?.name), readText(entry.author)]),
    externalId,
    publishedAt: parseDate(firstNonEmpty([readText(entry.published), readText(entry.updated)])),
    rawContent: firstNonEmpty([readText(entry.content), readText(entry.summary)]),
    rawMetadata: sanitizeMetadata(entry),
    title: readText(entry.title),
    url,
  };
}

function readAtomLink(value: unknown): string | null {
  const links = asArray(value);

  for (const entry of links) {
    const linkRecord = asRecord(entry);

    if (!linkRecord) {
      const linkText = readText(entry);

      if (linkText) {
        return linkText;
      }

      continue;
    }

    if (linkRecord.rel === "alternate" || !linkRecord.rel) {
      const href = readText(linkRecord.href);

      if (href) {
        return href;
      }
    }
  }

  return null;
}

function readUrl(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  const record = asRecord(value);

  if (!record) {
    return readText(value);
  }

  return firstNonEmpty([readText(record.href), readText(record.url), readText(record["#text"])]);
}

function readText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  return firstNonEmpty([readText(record["#text"]), readText(record.__cdata)]);
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function sanitizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function firstNonEmpty(values: Array<string | null>): string | null {
  for (const value of values) {
    if (value) {
      return value;
    }
  }

  return null;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
