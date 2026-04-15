export interface SubmittedUrlConnectorInput {
  submittedUrl: string;
}

export type SubmittedUrlVideoPlatform = "direct" | "vimeo" | "web" | "youtube";

export interface SubmittedUrlCaptureMetadata {
  contentType: string | null;
  extractor: string;
  extractorVersion: string;
  extractionStatus: "failed" | "succeeded";
  fetchTimestamp: string;
  finalUrl: string;
  httpStatus: number;
  redirectCount: number;
  submittedUrl: string;
  timeoutMs: number;
  userAgent: string;
}

export interface SubmittedUrlVideoMetadata {
  creatorName: string | null;
  creatorUrl: string | null;
  description: string | null;
  durationSeconds: number | null;
  embedUrl: string | null;
  platform: SubmittedUrlVideoPlatform;
  targetUrl: string;
  thumbnailUrl: string | null;
}

export interface SubmittedUrlArticleFetchResult {
  assetKind: "article";
  author: string | null;
  contentHtml: string | null;
  contentText: string;
  excerpt: string | null;
  language: string | null;
  metadata: SubmittedUrlCaptureMetadata;
  publishedAt: Date | null;
  siteName: string | null;
  title: string | null;
}

export interface SubmittedUrlVideoFetchResult {
  assetKind: "video";
  author: string | null;
  contentHtml: string | null;
  contentText: string;
  excerpt: string | null;
  language: string | null;
  metadata: SubmittedUrlCaptureMetadata & {
    video: SubmittedUrlVideoMetadata;
  };
  publishedAt: Date | null;
  siteName: string | null;
  title: string | null;
}

export type SubmittedUrlFetchResult = SubmittedUrlArticleFetchResult | SubmittedUrlVideoFetchResult;

export type SubmittedUrlConnectorFailureCode =
  | "extract_failed"
  | "invalid_redirect"
  | "network_error"
  | "non_html_response"
  | "redirect_limit_exceeded"
  | "response_error";

export class SubmittedUrlConnectorError extends Error {
  constructor(
    message: string,
    readonly details: SubmittedUrlCaptureMetadata & {
      bodyHtml?: string | null;
      bodyText?: string | null;
      code: SubmittedUrlConnectorFailureCode;
    },
  ) {
    super(message);
    this.name = "SubmittedUrlConnectorError";
  }
}

const MAX_REDIRECTS = 5;
const EXTRACTOR_NAME = "mozilla-readability";
const EXTRACTOR_VERSION = "first-pass";
const VIDEO_DIRECT_EXTRACTOR_NAME = "direct-video";
const VIDEO_HTML_EXTRACTOR_NAME = "html-video-meta";
const VIDEO_OEMBED_EXTRACTOR_NAME = "oembed";

export const URL_INGEST_TIMEOUT_MS = 15_000;
export const URL_INGEST_USER_AGENT = "SignalInboxURLIngest/0.1";

export async function fetchSubmittedUrlAsset(
  input: SubmittedUrlConnectorInput,
): Promise<SubmittedUrlFetchResult> {
  const knownVideoPlatform = detectKnownVideoPlatform(input.submittedUrl);

  if (knownVideoPlatform === "youtube" || knownVideoPlatform === "vimeo") {
    try {
      return await fetchVideoOEmbedAsset({
        platform: knownVideoPlatform,
        submittedUrl: input.submittedUrl,
      });
    } catch (error) {
      if (!(error instanceof SubmittedUrlConnectorError) || error.details.code !== "network_error") {
        throw error;
      }
    }
  }

  const [{ Readability }, { JSDOM }] = await Promise.all([
    import("@mozilla/readability"),
    import("jsdom"),
  ]);
  const fetchedAt = new Date();
  const response = await fetchWithRedirects(input.submittedUrl);
  const contentType = normalizeHeaderValue(response.response.headers.get("content-type"));
  const metadataBase = buildCaptureMetadata({
    contentType,
    extractionStatus: "failed",
    fetchTimestamp: fetchedAt.toISOString(),
    finalUrl: response.url,
    httpStatus: response.response.status,
    redirectCount: response.redirectCount,
    submittedUrl: input.submittedUrl,
  });

  if (isDirectVideoResponse(contentType)) {
    return buildDirectVideoFetchResult({
      contentType,
      fetchedAt,
      response,
      submittedUrl: input.submittedUrl,
    });
  }

  if (!isHtmlResponse(contentType)) {
    throw new SubmittedUrlConnectorError(
      `URL ingest expected HTML but received ${contentType ?? "an unknown content type"}.`,
      {
        ...metadataBase,
        bodyHtml: null,
        bodyText: null,
        code: "non_html_response",
      },
    );
  }

  const html = await response.response.text();
  const dom = new JSDOM(html, {
    url: response.url,
  });
  const document = dom.window.document;
  const videoMetadata = extractVideoMetadataFromDocument(document, response.url);

  if (videoMetadata) {
    return {
      assetKind: "video",
      author: videoMetadata.creatorName,
      contentHtml: html,
      contentText: buildVideoContentText({
        ...videoMetadata,
        title: videoMetadata.title,
      }),
      excerpt: videoMetadata.description,
      language: normalizeWhitespace(document.documentElement.lang),
      metadata: {
        ...buildCaptureMetadata({
          contentType,
          extractionStatus: "succeeded",
          extractor: VIDEO_HTML_EXTRACTOR_NAME,
          fetchTimestamp: fetchedAt.toISOString(),
          finalUrl: response.url,
          httpStatus: response.response.status,
          redirectCount: response.redirectCount,
          submittedUrl: input.submittedUrl,
        }),
        video: {
          creatorName: videoMetadata.creatorName,
          creatorUrl: videoMetadata.creatorUrl,
          description: videoMetadata.description,
          durationSeconds: videoMetadata.durationSeconds,
          embedUrl: videoMetadata.embedUrl,
          platform: videoMetadata.platform,
          targetUrl: response.url,
          thumbnailUrl: videoMetadata.thumbnailUrl,
        },
      },
      publishedAt: extractPublishedAt(document),
      siteName: videoMetadata.siteName,
      title: videoMetadata.title,
    };
  }

  const article = new Readability(document).parse();

  if (!article?.content?.trim()) {
    throw new SubmittedUrlConnectorError("URL ingest could not extract article-like content.", {
      ...metadataBase,
      bodyHtml: html,
      bodyText: null,
      code: "extract_failed",
    });
  }

  const contentText = normalizeWhitespace(article.textContent);

  if (!contentText) {
    throw new SubmittedUrlConnectorError("URL ingest extracted empty article content.", {
      ...metadataBase,
      bodyHtml: html,
      bodyText: null,
      code: "extract_failed",
    });
  }

  return {
    assetKind: "article",
    author: normalizeWhitespace(article.byline),
    contentHtml: article.content,
    contentText,
    excerpt: normalizeWhitespace(article.excerpt),
    language: normalizeWhitespace(document.documentElement.lang),
    metadata: {
      ...metadataBase,
      extractionStatus: "succeeded",
    },
    publishedAt: extractPublishedAt(document),
    siteName: normalizeWhitespace(article.siteName),
    title: normalizeWhitespace(article.title),
  };
}

export async function fetchSubmittedUrlArticle(
  input: SubmittedUrlConnectorInput,
): Promise<SubmittedUrlArticleFetchResult> {
  const result = await fetchSubmittedUrlAsset(input);

  if (result.assetKind !== "article") {
    throw new SubmittedUrlConnectorError("URL ingest detected a video target instead of an article.", {
      ...result.metadata,
      bodyHtml: result.contentHtml,
      bodyText: result.contentText,
      code: "extract_failed",
    });
  }

  return result;
}

async function fetchWithRedirects(submittedUrl: string) {
  let currentUrl = submittedUrl;
  let redirectCount = 0;

  while (true) {
    let response: Response;

    try {
      response = await fetch(currentUrl, {
        headers: {
          accept: "text/html,application/xhtml+xml,video/*",
          "user-agent": URL_INGEST_USER_AGENT,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(URL_INGEST_TIMEOUT_MS),
      });
    } catch {
      throw new SubmittedUrlConnectorError(`URL fetch failed for ${submittedUrl}.`, {
        ...buildCaptureMetadata({
          contentType: null,
          extractionStatus: "failed",
          fetchTimestamp: new Date().toISOString(),
          finalUrl: currentUrl,
          httpStatus: 0,
          redirectCount,
          submittedUrl,
        }),
        bodyHtml: null,
        bodyText: null,
        code: "network_error",
      });
    }

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");

      if (!location) {
        throw new SubmittedUrlConnectorError(
          `URL redirect response from ${currentUrl} did not include a location header.`,
          {
            ...buildCaptureMetadata({
              contentType: normalizeHeaderValue(response.headers.get("content-type")),
              extractionStatus: "failed",
              fetchTimestamp: new Date().toISOString(),
              finalUrl: currentUrl,
              httpStatus: response.status,
              redirectCount,
              submittedUrl,
            }),
            bodyHtml: null,
            bodyText: null,
            code: "invalid_redirect",
          },
        );
      }

      redirectCount += 1;

      if (redirectCount > MAX_REDIRECTS) {
        throw new SubmittedUrlConnectorError(`URL fetch exceeded ${MAX_REDIRECTS} redirects.`, {
          ...buildCaptureMetadata({
            contentType: normalizeHeaderValue(response.headers.get("content-type")),
            extractionStatus: "failed",
            fetchTimestamp: new Date().toISOString(),
            finalUrl: currentUrl,
            httpStatus: response.status,
            redirectCount,
            submittedUrl,
          }),
          bodyHtml: null,
          bodyText: null,
          code: "redirect_limit_exceeded",
        });
      }

      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      const contentType = normalizeHeaderValue(response.headers.get("content-type"));
      const bodyText = isHtmlResponse(contentType) || isTextResponse(contentType)
        ? await response.text()
        : null;

      throw new SubmittedUrlConnectorError(
        `URL fetch failed for ${submittedUrl} with status ${response.status}.`,
        {
          ...buildCaptureMetadata({
            contentType,
            extractionStatus: "failed",
            fetchTimestamp: new Date().toISOString(),
            finalUrl: response.url || currentUrl,
            httpStatus: response.status,
            redirectCount,
            submittedUrl,
          }),
          bodyHtml: isHtmlResponse(contentType) ? bodyText : null,
          bodyText,
          code: "response_error",
        },
      );
    }

    return {
      redirectCount,
      response,
      url: response.url || currentUrl,
    };
  }
}

async function fetchVideoOEmbedAsset(input: {
  platform: Extract<SubmittedUrlVideoPlatform, "vimeo" | "youtube">;
  submittedUrl: string;
}): Promise<SubmittedUrlVideoFetchResult> {
  const fetchedAt = new Date();
  const endpoint =
    input.platform === "youtube"
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(input.submittedUrl)}&format=json`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(input.submittedUrl)}`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": URL_INGEST_USER_AGENT,
      },
      signal: AbortSignal.timeout(URL_INGEST_TIMEOUT_MS),
    });
  } catch {
    throw new SubmittedUrlConnectorError(`URL fetch failed for ${input.submittedUrl}.`, {
      ...buildCaptureMetadata({
        contentType: null,
        extractionStatus: "failed",
        extractor: VIDEO_OEMBED_EXTRACTOR_NAME,
        fetchTimestamp: fetchedAt.toISOString(),
        finalUrl: input.submittedUrl,
        httpStatus: 0,
        redirectCount: 0,
        submittedUrl: input.submittedUrl,
      }),
      bodyHtml: null,
      bodyText: null,
      code: "network_error",
    });
  }

  if (!response.ok) {
    const bodyText = await response.text();

    throw new SubmittedUrlConnectorError(
      `URL fetch failed for ${input.submittedUrl} with status ${response.status}.`,
      {
        ...buildCaptureMetadata({
          contentType: normalizeHeaderValue(response.headers.get("content-type")),
          extractionStatus: "failed",
          extractor: VIDEO_OEMBED_EXTRACTOR_NAME,
          fetchTimestamp: fetchedAt.toISOString(),
          finalUrl: response.url || input.submittedUrl,
          httpStatus: response.status,
          redirectCount: 0,
          submittedUrl: input.submittedUrl,
        }),
        bodyHtml: null,
        bodyText,
        code: "response_error",
      },
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const title = normalizeWhitespace(readUnknownString(payload.title));
  const creatorName = normalizeWhitespace(readUnknownString(payload.author_name));
  const creatorUrl = normalizeWhitespace(readUnknownString(payload.author_url));
  const description = normalizeWhitespace(readUnknownString(payload.description));
  const siteName = normalizeWhitespace(readUnknownString(payload.provider_name));
  const thumbnailUrl = normalizeWhitespace(readUnknownString(payload.thumbnail_url));
  const durationSeconds = parseDurationSeconds(payload.duration);
  const embedUrl = extractEmbedUrlFromOEmbedHtml(readUnknownString(payload.html));
  const videoMetadata: SubmittedUrlVideoMetadata = {
    creatorName,
    creatorUrl,
    description,
    durationSeconds,
    embedUrl,
    platform: input.platform,
    targetUrl: input.submittedUrl,
    thumbnailUrl,
  };

  return {
    assetKind: "video",
    author: creatorName,
    contentHtml: null,
    contentText: buildVideoContentText({
      ...videoMetadata,
      title,
    }),
    excerpt: description,
    language: null,
    metadata: {
      ...buildCaptureMetadata({
        contentType: normalizeHeaderValue(response.headers.get("content-type")),
        extractionStatus: "succeeded",
        extractor: VIDEO_OEMBED_EXTRACTOR_NAME,
        fetchTimestamp: fetchedAt.toISOString(),
        finalUrl: input.submittedUrl,
        httpStatus: response.status,
        redirectCount: 0,
        submittedUrl: input.submittedUrl,
      }),
      video: videoMetadata,
    },
    publishedAt: null,
    siteName,
    title,
  };
}

function buildDirectVideoFetchResult(input: {
  contentType: string | null;
  fetchedAt: Date;
  response: Awaited<ReturnType<typeof fetchWithRedirects>>;
  submittedUrl: string;
}): SubmittedUrlVideoFetchResult {
  const title = titleFromUrl(input.response.url);
  const platform = detectKnownVideoPlatform(input.response.url) ?? "direct";
  const videoMetadata: SubmittedUrlVideoMetadata = {
    creatorName: null,
    creatorUrl: null,
    description: null,
    durationSeconds: null,
    embedUrl: null,
    platform,
    targetUrl: input.response.url,
    thumbnailUrl: null,
  };

  return {
    assetKind: "video",
    author: null,
    contentHtml: null,
    contentText: buildVideoContentText({
      ...videoMetadata,
      title,
    }),
    excerpt: null,
    language: null,
    metadata: {
      ...buildCaptureMetadata({
        contentType: input.contentType,
        extractionStatus: "succeeded",
        extractor: VIDEO_DIRECT_EXTRACTOR_NAME,
        fetchTimestamp: input.fetchedAt.toISOString(),
        finalUrl: input.response.url,
        httpStatus: input.response.response.status,
        redirectCount: input.response.redirectCount,
        submittedUrl: input.submittedUrl,
      }),
      video: videoMetadata,
    },
    publishedAt: null,
    siteName: formatHostLabel(input.response.url),
    title,
  };
}

function buildCaptureMetadata(
  input: Omit<SubmittedUrlCaptureMetadata, "extractor" | "extractorVersion" | "timeoutMs" | "userAgent"> & {
    extractor?: string;
    extractorVersion?: string;
  },
): SubmittedUrlCaptureMetadata {
  return {
    ...input,
    extractor: input.extractor ?? EXTRACTOR_NAME,
    extractorVersion: input.extractorVersion ?? EXTRACTOR_VERSION,
    timeoutMs: URL_INGEST_TIMEOUT_MS,
    userAgent: URL_INGEST_USER_AGENT,
  };
}

function extractPublishedAt(document: Document): Date | null {
  const publishedAt = firstNonEmpty([
    readMetaContent(document, 'meta[property="article:published_time"]'),
    readMetaContent(document, 'meta[name="article:published_time"]'),
    readMetaContent(document, 'meta[name="pubdate"]'),
    readMetaContent(document, 'meta[name="publishdate"]'),
    readMetaContent(document, 'meta[name="timestamp"]'),
    readMetaContent(document, 'meta[property="og:article:published_time"]'),
    readAttribute(document, "time[datetime]", "datetime"),
  ]);

  if (!publishedAt) {
    return null;
  }

  const parsed = new Date(publishedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractVideoMetadataFromDocument(
  document: Document,
  targetUrl: string,
): (SubmittedUrlVideoMetadata & { siteName: string | null; title: string | null }) | null {
  const ogType = readMetaContent(document, 'meta[property="og:type"]')?.toLowerCase() ?? null;
  const siteName = firstNonEmpty([
    readMetaContent(document, 'meta[property="og:site_name"]'),
    readMetaContent(document, 'meta[name="application-name"]'),
    formatHostLabel(targetUrl),
  ]);
  const title = firstNonEmpty([
    readMetaContent(document, 'meta[property="og:title"]'),
    readMetaContent(document, 'meta[name="twitter:title"]'),
    normalizeWhitespace(document.title),
  ]);
  const description = firstNonEmpty([
    readMetaContent(document, 'meta[property="og:description"]'),
    readMetaContent(document, 'meta[name="description"]'),
    readMetaContent(document, 'meta[name="twitter:description"]'),
  ]);
  const creatorName = firstNonEmpty([
    readMetaContent(document, 'meta[name="author"]'),
    readMetaContent(document, 'meta[name="twitter:creator"]'),
    readMetaContent(document, 'meta[itemprop="author"]'),
  ]);
  const creatorUrl = readMetaContent(document, 'meta[property="article:author"]');
  const thumbnailUrl = firstNonEmpty([
    readMetaContent(document, 'meta[property="og:image"]'),
    readMetaContent(document, 'meta[name="twitter:image"]'),
  ]);
  const embedUrl = firstNonEmpty([
    readMetaContent(document, 'meta[property="og:video:url"]'),
    readMetaContent(document, 'meta[property="og:video"]'),
    readMetaContent(document, 'meta[name="twitter:player"]'),
    readAttribute(document, "video source", "src"),
  ]);
  const durationSeconds = parseDurationSeconds(
    firstNonEmpty([
      readMetaContent(document, 'meta[property="video:duration"]'),
      readMetaContent(document, 'meta[property="og:video:duration"]'),
      readMetaContent(document, 'meta[itemprop="duration"]'),
    ]),
  );
  const platform = detectKnownVideoPlatform(targetUrl);
  const isVideoDocument =
    Boolean(platform) ||
    ogType?.startsWith("video.") === true ||
    ogType === "video" ||
    Boolean(embedUrl) ||
    Boolean(document.querySelector("video"));

  if (!isVideoDocument) {
    return null;
  }

  return {
    creatorName,
    creatorUrl,
    description,
    durationSeconds,
    embedUrl,
    platform: platform ?? "web",
    siteName,
    targetUrl,
    thumbnailUrl,
    title,
  };
}

function readMetaContent(document: Document, selector: string): string | null {
  return normalizeWhitespace(document.querySelector(selector)?.getAttribute("content"));
}

function readAttribute(document: Document, selector: string, attribute: string): string | null {
  return normalizeWhitespace(document.querySelector(selector)?.getAttribute(attribute));
}

function normalizeHeaderValue(value: string | null): string | null {
  return normalizeWhitespace(value);
}

function readUnknownString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeWhitespace(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function firstNonEmpty(values: Array<string | null>): string | null {
  return values.find((value) => value !== null) ?? null;
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

function isHtmlResponse(contentType: string | null) {
  return Boolean(
    contentType &&
      (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")),
  );
}

function isTextResponse(contentType: string | null) {
  return Boolean(contentType && contentType.startsWith("text/"));
}

function isDirectVideoResponse(contentType: string | null) {
  return Boolean(contentType && contentType.toLowerCase().startsWith("video/"));
}

function detectKnownVideoPlatform(urlString: string): SubmittedUrlVideoPlatform | null {
  try {
    const hostname = new URL(urlString).hostname.toLowerCase().replace(/^www\./, "");

    if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "youtu.be") {
      return "youtube";
    }

    if (hostname === "vimeo.com" || hostname.endsWith(".vimeo.com")) {
      return "vimeo";
    }
  } catch {
    return null;
  }

  return null;
}

function titleFromUrl(urlString: string) {
  try {
    const pathname = new URL(urlString).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).at(-1);

    if (!lastSegment) {
      return "Video item";
    }

    const decodedSegment = decodeURIComponent(lastSegment).replace(/\.[a-z0-9]+$/i, "");
    const humanized = decodedSegment.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

    return humanized ? humanized.charAt(0).toUpperCase() + humanized.slice(1) : "Video item";
  } catch {
    return "Video item";
  }
}

function formatHostLabel(urlString: string) {
  try {
    return new URL(urlString).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function parseDurationSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.round(Number(trimmed));
  }

  const isoMatch = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(trimmed);

  if (!isoMatch) {
    return null;
  }

  const hours = Number(isoMatch[1] ?? 0);
  const minutes = Number(isoMatch[2] ?? 0);
  const seconds = Number(isoMatch[3] ?? 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function extractEmbedUrlFromOEmbedHtml(html: string | null) {
  if (!html) {
    return null;
  }

  const match = /src="([^"]+)"/i.exec(html);
  return normalizeWhitespace(match?.[1] ?? null);
}

function buildVideoContentText(input: SubmittedUrlVideoMetadata & { title: string | null }) {
  const lines = [
    input.title ? `Video title: ${input.title}` : null,
    `Platform: ${formatPlatformLabel(input.platform)}`,
    input.creatorName ? `Creator: ${input.creatorName}` : null,
    input.durationSeconds !== null ? `Duration: ${formatDurationLabel(input.durationSeconds)}` : null,
    input.description ? `Description: ${input.description}` : null,
    `Target URL: ${input.targetUrl}`,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

function formatPlatformLabel(platform: SubmittedUrlVideoPlatform) {
  switch (platform) {
    case "youtube":
      return "YouTube";
    case "vimeo":
      return "Vimeo";
    case "direct":
      return "Direct video";
    default:
      return "Video";
  }
}

function formatDurationLabel(durationSeconds: number) {
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
