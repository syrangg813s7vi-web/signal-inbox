import { itemGroupMembers, itemGroups } from "@signal-inbox/db";

import type { ClassifyStepResult, GroupStepResult } from "./types";
import { slugify } from "./utils";

type DatabaseTransaction = Parameters<
  Parameters<import("@signal-inbox/db").SignalInboxDatabase["transaction"]>[0]
>[0];

export async function groupItem(
  tx: DatabaseTransaction,
  input: {
    classification: ClassifyStepResult;
    itemId: string;
  },
): Promise<GroupStepResult> {
  const topic = input.classification.topic?.trim();

  if (!topic) {
    return {
      groupId: null,
      tag: null,
      title: null,
    };
  }

  const tag = slugify(topic);

  const [group] = await tx
    .insert(itemGroups)
    .values({
      groupType: "topic",
      summary: `Items related to ${topic}.`,
      tag,
      title: topic,
    })
    .onConflictDoUpdate({
      set: {
        summary: `Items related to ${topic}.`,
        title: topic,
        updatedAt: new Date(),
      },
      target: [itemGroups.groupType, itemGroups.tag],
    })
    .returning({
      id: itemGroups.id,
      title: itemGroups.title,
    });

  if (!group) {
    return {
      groupId: null,
      tag,
      title: topic,
    };
  }

  await tx
    .insert(itemGroupMembers)
    .values({
      groupId: group.id,
      itemId: input.itemId,
    })
    .onConflictDoNothing();

  return {
    groupId: group.id,
    tag,
    title: group.title,
  };
}
