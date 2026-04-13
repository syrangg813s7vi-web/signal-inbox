import { eq, inArray } from "drizzle-orm";

import { knowledgeDestinations } from "@signal-inbox/db";

import { syncNoteToNotionDestination } from "./notion-destination";
import { syncNoteToObsidianDestination } from "./obsidian-destination";
import type {
  BuiltNoteResult,
  KnowledgeDestinationRecord,
  KnowledgeSyncResult,
} from "./types";

type DatabaseTransaction = Parameters<
  Parameters<import("@signal-inbox/db").SignalInboxDatabase["transaction"]>[0]
>[0];

const DEFAULT_DESTINATIONS = [
  {
    destinationType: "notion" as const,
    metadata: {
      format: "page",
      seededBy: "knowledge-layer",
    },
    name: "Notion Knowledge",
    targetRef: "notion://signal-inbox/default",
  },
  {
    destinationType: "obsidian" as const,
    metadata: {
      directory: "Signal Inbox",
      format: "markdown",
      seededBy: "knowledge-layer",
    },
    name: "Obsidian Knowledge",
    targetRef: "obsidian://signal-inbox/default",
  },
];

export async function syncNoteToKnowledgeDestinations(
  tx: DatabaseTransaction,
  note: BuiltNoteResult & { id: string },
): Promise<KnowledgeSyncResult[]> {
  const destinations = await ensureDefaultKnowledgeDestinations(tx);

  return destinations.map((destination) => {
    if (destination.destinationType === "notion") {
      return syncNoteToNotionDestination(note, destination);
    }

    return syncNoteToObsidianDestination(note, destination);
  });
}

async function ensureDefaultKnowledgeDestinations(
  tx: DatabaseTransaction,
): Promise<KnowledgeDestinationRecord[]> {
  const existing = await tx
    .select({
      destinationType: knowledgeDestinations.destinationType,
      id: knowledgeDestinations.id,
      metadata: knowledgeDestinations.metadata,
      name: knowledgeDestinations.name,
      status: knowledgeDestinations.status,
      targetRef: knowledgeDestinations.targetRef,
    })
    .from(knowledgeDestinations)
    .where(inArray(knowledgeDestinations.destinationType, ["notion", "obsidian"]));

  const existingTypes = new Set(existing.map((destination) => destination.destinationType));
  const missingDefaults = DEFAULT_DESTINATIONS.filter(
    (destination) => !existingTypes.has(destination.destinationType),
  );

  if (missingDefaults.length > 0) {
    await tx.insert(knowledgeDestinations).values(missingDefaults);
  }

  return tx
    .select({
      destinationType: knowledgeDestinations.destinationType,
      id: knowledgeDestinations.id,
      metadata: knowledgeDestinations.metadata,
      name: knowledgeDestinations.name,
      status: knowledgeDestinations.status,
      targetRef: knowledgeDestinations.targetRef,
    })
    .from(knowledgeDestinations)
    .where(eq(knowledgeDestinations.status, "active"));
}
