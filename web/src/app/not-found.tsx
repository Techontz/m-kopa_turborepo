import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mf-error-page">
      <div className="card">
        <div className="body">
          <h1>404</h1>
          <h4>Page not found</h4>
          <p className="text-muted">The page you are looking for does not exist or you do not have access to it.</p>
          <Link href="/dashboard" className="btn btn-primary"><i className="icon-home" /> Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
