type DraftRequestUiStateInput = {
  status: string;
  canEditDraft: boolean;
  isOwner: boolean;
};

export function getDraftRequestUiState({
  status,
  canEditDraft,
  isOwner,
}: DraftRequestUiStateInput) {
  const isDraft = status === "DRAFT";

  return {
    showEditableDraftSections: isDraft && canEditDraft,
    showReadOnlyDraftSections: isDraft && !canEditDraft,
    canSubmitDraft: isDraft && isOwner,
  };
}
