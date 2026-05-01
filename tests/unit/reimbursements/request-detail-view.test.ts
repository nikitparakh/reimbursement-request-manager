import { describe, expect, it } from "vitest";
import { getDraftRequestUiState } from "@/lib/reimbursements/request-detail-view";

describe("getDraftRequestUiState", () => {
  it("shows editable draft controls for owners", () => {
    expect(
      getDraftRequestUiState({
        status: "DRAFT",
        canEditDraft: true,
        isOwner: true,
      })
    ).toEqual({
      showEditableDraftSections: true,
      showReadOnlyDraftSections: false,
      canSubmitDraft: true,
    });
  });

  it("keeps coach/admin draft editors but hides submit for non-owners", () => {
    expect(
      getDraftRequestUiState({
        status: "DRAFT",
        canEditDraft: true,
        isOwner: false,
      })
    ).toEqual({
      showEditableDraftSections: true,
      showReadOnlyDraftSections: false,
      canSubmitDraft: false,
    });
  });

  it("shows read-only draft sections to viewers without edit permission", () => {
    expect(
      getDraftRequestUiState({
        status: "DRAFT",
        canEditDraft: false,
        isOwner: false,
      })
    ).toEqual({
      showEditableDraftSections: false,
      showReadOnlyDraftSections: true,
      canSubmitDraft: false,
    });
  });
});
