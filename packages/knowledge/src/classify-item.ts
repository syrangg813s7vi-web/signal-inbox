import type { ClassifyStepResult, ProcessableItemRecord } from "./types";
import { firstNonEmpty, slugify } from "./utils";

interface ClassificationRule {
  classification: string;
  tags: string[];
  topic: string;
  when: RegExp;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    classification: "research",
    tags: ["research", "analysis"],
    topic: "Research",
    when: /\b(research|paper|study|benchmark|report)\b/,
  },
  {
    classification: "product-update",
    tags: ["product", "release"],
    topic: "Product updates",
    when: /\b(release|launch|shipped|announced|announcement|beta)\b/,
  },
  {
    classification: "tutorial",
    tags: ["tutorial", "guide"],
    topic: "Guides",
    when: /\b(tutorial|guide|walkthrough|how to)\b/,
  },
  {
    classification: "news",
    tags: ["news"],
    topic: "News",
    when: /\b(news|update|roundup|round-up)\b/,
  },
];

export function classifyItem(item: ProcessableItemRecord): ClassifyStepResult {
  const classificationSource = [
    item.sourceTopic,
    item.title,
    item.contentText,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase();

  const matchedRule = CLASSIFICATION_RULES.find((rule) => rule.when.test(classificationSource));
  const fallbackTopic = firstNonEmpty(item.sourceTopic);
  const topic = firstNonEmpty(matchedRule?.topic, fallbackTopic, item.title ? deriveTopicFromTitle(item.title) : null);
  const tags = new Set<string>();

  if (matchedRule) {
    for (const tag of matchedRule.tags) {
      tags.add(tag);
    }
  }

  if (topic) {
    tags.add(slugify(topic).replace(/-/g, "_"));
  }

  if (item.language?.trim()) {
    tags.add(`lang_${item.language.toLowerCase()}`);
  }

  return {
    classification: matchedRule?.classification ?? (fallbackTopic ? "topic-tracked" : "general"),
    tags: Array.from(tags),
    topic,
  };
}

function deriveTopicFromTitle(title: string) {
  const cleanedTitle = title
    .replace(/[|:]\s.+$/, "")
    .trim();

  return cleanedTitle.length > 80 ? cleanedTitle.slice(0, 80).trimEnd() : cleanedTitle;
}
