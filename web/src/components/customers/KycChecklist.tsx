import type { ChecklistItem } from "./types";

/** KYC completion checklist (Documents §7); the customer is eligible for loans only when every item is done. */
export function KycChecklist({ items }: { items: ChecklistItem[] }) {
  const complete = items.length > 0 && items.every((item) => item.done);

  return (
    <div>
      <ul className="list-unstyled mb-2">
        {items.map((item) => (
          <li key={item.key} className="mb-1">
            <i className={item.done ? "fa fa-check-circle text-success" : "fa fa-times-circle text-danger"} /> {item.label}
          </li>
        ))}
      </ul>
      {complete ? <span className="badge badge-success">KYC Completed</span> : <span className="badge badge-danger">KYC Pending</span>}
    </div>
  );
}
