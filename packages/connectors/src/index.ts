export {
  fetchRssFeed,
  RssConnectorError,
  type RssConnectorSource,
  type RssFeedAsset,
  type RssFeedFetchResult,
  type RssFeedMetadata,
} from "./rss-connector";

export const connectorsPackage = {
  name: "@signal-inbox/connectors",
  responsibility: "Source-specific fetch logic and source adaptation.",
} as const;
