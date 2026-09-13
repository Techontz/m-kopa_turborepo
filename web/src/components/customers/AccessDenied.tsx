import { Card } from "@/components/ui/Card";

/** Shown when the signed-in user lacks the permission a customer page needs (the API refuses it too). */
export function AccessDenied({ message = "You do not have permission to open this page." }: { message?: string }) {
  return (
    <Card>
      <div className="mf-access-denied" role="alert">
        <i className="icon-lock" />
        <h5>Access denied</h5>
        <p className="mb-0">{message}</p>
      </div>
    </Card>
  );
}
