import type { Item, ProcessorName } from "@signal-inbox/core";

export interface ItemProcessor {
  name: ProcessorName;
}

export interface ProcessorResult {
  item: Item;
}

export const processorsPackageStatus = "placeholder";
