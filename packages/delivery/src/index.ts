export const deliveryDestinationKinds = ["notion", "obsidian", "feishu"] as const;

export type DeliveryDestinationKind = (typeof deliveryDestinationKinds)[number];
