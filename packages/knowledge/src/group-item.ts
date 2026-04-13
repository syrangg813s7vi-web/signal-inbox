import { and, eq } from "drizzle-orm";

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

  const [existingGroup] = await tx
    .select({
      id: itemGroups.id,
      title: itemGroups.title,
    })
    .from(itemGroups)
    .where(and(eq(itemGroups.groupType, "topic"), eq(itemGroups.tag, tag)));

  const group =
    existingGroup ??
    (
      await tx
        .insert(itemGroups)
        .values({
          groupType: "topic",
          summary: `Items related to ${topic}.`,
          tag,
          title: topic,
        })
        .returning({
          id: itemGroups.id,
          title: itemGroups.title,
        })
    )[0];

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
