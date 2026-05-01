import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function PolicyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Reimbursement Policy</h1>
        <p className="text-sm text-slate-600">
          This policy explains the basic expectations for submitting and reviewing robotics reimbursement requests.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Eligible Requests</h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>Submit only team-related expenses that support approved robotics activities, events, or operations.</p>
          <p>Each request must include clear receipts or invoices and enough detail for a coach or admin to verify the purchase.</p>
          <p>Personal purchases, duplicate submissions, and unsupported expenses may be rejected.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Submitter Responsibilities</h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>Provide accurate titles, descriptions, receipts, and line-item details before submitting a request.</p>
          <p>Respond promptly if a coach or admin asks for clarification, corrections, or updated documentation.</p>
          <p>Keep your mailing address and Zelle details current so reimbursements can be processed correctly.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Review and Payment</h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>Requests may be reviewed by coaches first and then by school or program administrators, depending on the workflow for your team.</p>
          <p>Reviewers may remove unsupported items, request clarification, or reject a request with comments.</p>
          <p>Approval does not guarantee immediate payment; reimbursement timing depends on administrative processing.</p>
        </CardContent>
      </Card>
    </div>
  );
}
