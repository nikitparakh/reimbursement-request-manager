import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PolicyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-10">
      <PageHeader
        title="Reimbursement policy"
        description="This policy explains the basic expectations for submitting and reviewing robotics reimbursement requests."
      />

      <Card>
        <CardHeader>
          <CardTitle>Eligible requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <p className="text-muted-foreground">
            Submit only team-related expenses that support approved robotics activities, events, or operations.
          </p>
          <p className="text-muted-foreground">
            Each request must include clear receipts or invoices and enough detail for a coach or admin to verify the
            purchase.
          </p>
          <p className="text-muted-foreground">
            Personal purchases, duplicate submissions, and unsupported expenses may be rejected.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submitter responsibilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <p className="text-muted-foreground">
            Provide accurate titles, descriptions, receipts, and line-item details before submitting a request.
          </p>
          <p className="text-muted-foreground">
            Respond promptly if a coach or admin asks for clarification, corrections, or updated documentation.
          </p>
          <p className="text-muted-foreground">
            Keep your mailing address and Zelle details current so reimbursements can be processed correctly.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review and payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <p className="text-muted-foreground">
            Requests may be reviewed by coaches first and then by school or program administrators, depending on the
            workflow for your team.
          </p>
          <p className="text-muted-foreground">
            Reviewers may remove unsupported items, request clarification, or reject a request with comments.
          </p>
          <p className="text-muted-foreground">
            Approval does not guarantee immediate payment; reimbursement timing depends on administrative processing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
