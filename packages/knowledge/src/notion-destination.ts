import type { BuiltNoteResult, KnowledgeDestinationRecord, KnowledgeSyncResult } from "./types";
import { slugify } from "./utils";

export function syncNoteToNotionDestination(
  note: BuiltNoteResult & { id: string },
  destination: KnowledgeDestinationRecord,
): KnowledgeSyncResult {
  const syncedAt = new Date().toISOString();
  const slug = slugify(note.title) || note.id;

  return {
    destinationId: destination.id,
    destinationType: destination.destinationType,
    externalRef: `${destination.targetRef}/page/${slug}`,
    message: `Prepared Notion page payload for ${note.title}.`,
    status: "success",
    syncedAt,
    targetRef: destination.targetRef,
  };
}
