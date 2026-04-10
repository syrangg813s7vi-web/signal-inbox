export const connectorKinds = ["rss", "twitter_list", "wechat"] as const;

export type ConnectorKind = (typeof connectorKinds)[number];
