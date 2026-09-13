"use client";

import { useState, type FormEvent } from "react";

import { notifyError } from "@/components/ui/notify";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = payload?.errors ? Object.values(payload.errors as Record<string, string[]>)[0]?.[0] : payload?.message;
        throw new Error(message ?? "Phone number or password is incorrect");
      }
      window.location.href = "/dashboard";
    } catch (error) {
      notifyError(error);
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div id="wrapper">
        <div className="vertical-align-wrap">
          <div className="vertical-align-middle auth-main">
            <div className="auth-box">
              <div className="top" />
              <div className="card">
                <div className="header">
                  <p className="lead">Login to your account</p>
                </div>
                <div className="body">
                  <form className="form-auth-small" onSubmit={submit}>
                    <div className="form-group">
                      <label htmlFor="signin-phone" className="control-label sr-only">Phone number</label>
                      <input type="number" className="form-control" id="signin-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Eg.0753(XXXX)34" required autoComplete="off" />
                    </div>
                    <div className="form-group mt-3">
                      <label htmlFor="signin-password" className="control-label sr-only">Password</label>
                      <input type="password" className="form-control" id="signin-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="******" required />
                    </div>
                    <button type="submit" className="btn btn-warning btn-lg btn-block" disabled={submitting}>
                      {submitting ? "..." : "LOGIN"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
            <div className="mf-marquee"><h5>FASTAMIKOPO MICROFINANCE &copy; {new Date().getFullYear()}</h5></div>
          </div>
        </div>
      </div>
    </div>
  );
}
