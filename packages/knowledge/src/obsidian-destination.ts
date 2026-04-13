import type { BuiltNoteResult, KnowledgeDestinationRecord, KnowledgeSyncResult } from "./types";
import { slugify } from "./utils";

export function syncNoteToObsidianDestination(
  note: BuiltNoteResult & { id: string },
  destination: KnowledgeDestinationRecord,
): KnowledgeSyncResult {
  const syncedAt = new Date().toISOString();
  const slug = slugify(note.title) || note.id;

  return {
    destinationId: destination.id,
    destinationType: destination.destinationType,
    externalRef: `${destination.targetRef}/${slug}.md`,
    message: `Prepared Obsidian note payload for ${note.title}.`,
    status: "success",
    syncedAt,
    targetRef: destination.targetRef,
  };
}
