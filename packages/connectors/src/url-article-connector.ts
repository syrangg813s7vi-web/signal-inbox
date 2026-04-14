export interface SubmittedUrlConnectorInput {
  submittedUrl: string;
}

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

export interface SubmittedUrlArticleFetchResult {
  author: string | null;
  contentHtml: string;
  contentText: string;
  excerpt: string | null;
  language: string | null;
  metadata: SubmittedUrlCaptureMetadata;
  publishedAt: Date | null;
  siteName: string | null;
  title: string | null;
}

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

export const URL_INGEST_TIMEOUT_MS = 15_000;
export const URL_INGEST_USER_AGENT = "SignalInboxURLIngest/0.1";

export async function fetchSubmittedUrlArticle(
  input: SubmittedUrlConnectorInput,
): Promise<SubmittedUrlArticleFetchResult> {
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

async function fetchWithRedirects(submittedUrl: string) {
  let currentUrl = submittedUrl;
  let redirectCount = 0;

  while (true) {
    let response: Response;

    try {
      response = await fetch(currentUrl, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": URL_INGEST_USER_AGENT,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(URL_INGEST_TIMEOUT_MS),
      });
    } catch (error) {
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

function buildCaptureMetadata(
  input: Omit<SubmittedUrlCaptureMetadata, "extractor" | "extractorVersion" | "timeoutMs" | "userAgent">,
): SubmittedUrlCaptureMetadata {
  return {
    ...input,
    extractor: EXTRACTOR_NAME,
    extractorVersion: EXTRACTOR_VERSION,
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

function readMetaContent(document: Document, selector: string): string | null {
  return normalizeWhitespace(document.querySelector(selector)?.getAttribute("content"));
}

function readAttribute(document: Document, selector: string, attribute: string): string | null {
  return normalizeWhitespace(document.querySelector(selector)?.getAttribute(attribute));
}

function normalizeHeaderValue(value: string | null): string | null {
  return normalizeWhitespace(value);
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
