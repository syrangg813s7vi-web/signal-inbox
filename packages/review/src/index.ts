export const reviewPackage = {
  name: "@signal-inbox/review",
  responsibility: "Digest generation and review selection.",
} as const;

export {
  listSelectedInboxItems,
  refreshInboxSelections,
  type InboxCandidate,
  type InboxSelectionDecision,
  type InboxSelectionScoreBreakdown,
  type RefreshInboxSelectionsResult,
  type SelectedInboxItem,
} from "./inbox-selection";
