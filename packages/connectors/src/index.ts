export {
  fetchRssFeed,
  RssConnectorError,
  type RssConnectorSource,
  type RssFeedAsset,
  type RssFeedFetchResult,
  type RssFeedMetadata,
} from "./rss-connector";
export {
  fetchSubmittedUrlArticle,
  SubmittedUrlConnectorError,
  URL_INGEST_USER_AGENT,
  URL_INGEST_TIMEOUT_MS,
  type SubmittedUrlArticleFetchResult,
  type SubmittedUrlCaptureMetadata,
  type SubmittedUrlConnectorInput,
  type SubmittedUrlConnectorFailureCode,
} from "./url-article-connector";

export const connectorsPackage = {
  name: "@signal-inbox/connectors",
  responsibility: "Source-specific fetch logic and source adaptation.",
} as const;
