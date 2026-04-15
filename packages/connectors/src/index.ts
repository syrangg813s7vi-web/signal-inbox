export {
  fetchRssFeed,
  RssConnectorError,
  type RssConnectorSource,
  type RssFeedAsset,
  type RssFeedFetchResult,
  type RssFeedMetadata,
} from "./rss-connector";
export {
  fetchSubmittedUrlAsset,
  fetchSubmittedUrlArticle,
  SubmittedUrlConnectorError,
  URL_INGEST_USER_AGENT,
  URL_INGEST_TIMEOUT_MS,
  type SubmittedUrlFetchResult,
  type SubmittedUrlArticleFetchResult,
  type SubmittedUrlCaptureMetadata,
  type SubmittedUrlConnectorInput,
  type SubmittedUrlConnectorFailureCode,
  type SubmittedUrlVideoFetchResult,
  type SubmittedUrlVideoMetadata,
  type SubmittedUrlVideoPlatform,
} from "./url-article-connector";

export const connectorsPackage = {
  name: "@signal-inbox/connectors",
  responsibility: "Source-specific fetch logic and source adaptation.",
} as const;
