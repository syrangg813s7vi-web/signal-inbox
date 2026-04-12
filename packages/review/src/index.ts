import type { Digest, ReviewObject } from "@signal-inbox/core";

export interface ReviewModulePlaceholder {
  digests: "pending";
  reviewObjects: "pending";
}

export interface ReviewProjection {
  digest?: Digest;
  reviewObjects: ReviewObject[];
}

export const reviewModulePlaceholder: ReviewModulePlaceholder = {
  digests: "pending",
  reviewObjects: "pending",
};
