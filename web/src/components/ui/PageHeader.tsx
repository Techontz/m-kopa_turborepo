import Link from "next/link";
import type { ReactNode } from "react";

/** Breadcrumb row under the top bar (home icon / crumb / crumb), with optional right-side content. */
export function PageHeader({ crumbs, right }: { crumbs: string[]; right?: ReactNode }) {
  return (
    <div className="block-header">
      <div className="row">
        <div className="col-lg-6 col-md-8 col-sm-12">
          <ul className="breadcrumb">
            <li className="breadcrumb-item">
              <Link href="/dashboard"><i className="icon-home" /></Link>
            </li>
            {crumbs.map((crumb) => (
              <li className="breadcrumb-item active" key={crumb}>{crumb}</li>
            ))}
          </ul>
        </div>
        <div className="col-lg-6 col-md-4 col-sm-12 text-right">{right}</div>
      </div>
    </div>
  );
}
