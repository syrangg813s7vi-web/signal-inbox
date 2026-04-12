import type { Destination, Digest, Item } from "@signal-inbox/core";

export interface DeliveryRequest {
  destination: Destination;
  content: Item | Digest;
}

export interface DeliveryResult {
  status: "success" | "failed";
  message?: string;
  deliveredAt?: Date;
}

export const deliveryPackageStatus = "placeholder";
