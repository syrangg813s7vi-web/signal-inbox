import type {
  DeliveryDestination,
  Digest,
  ReviewObject,
} from "@signal-inbox/core";

export interface DeliveryRequest {
  destination: DeliveryDestination;
  content: Digest | ReviewObject;
}

export interface DeliveryResult {
  status: "success" | "failed";
  message?: string;
  deliveredAt?: Date;
}

export const deliveryPackageStatus = "placeholder";
