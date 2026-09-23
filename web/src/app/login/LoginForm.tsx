"use client";

import { useState, type FormEvent } from "react";
import Swal from "sweetalert2";

import { notifyError } from "@/components/ui/notify";

import styles from "./login.module.css";

/** Staff passwords are reset by HR/administrators (hrm staff reset-password); there is no self-service reset. */
function showForgotPin() {
  void Swal.fire({ title: "Forgot PIN?", text: "Ask your branch manager or the administrator to reset your PIN from Staff management.", icon: "info", confirmButtonText: "Yes!" });
}

export function LoginForm() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pinShown, setPinShown] = useState(false);
  const [keep, setKeep] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\s+/g, ""), password: pin, remember: keep }),
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
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.eyebrow}>
        <span className={styles.eyebrowBar} />
        <span>MICROFINANCE</span>
      </div>

      <h1 className={styles.title}>Log in to your account</h1>

      <p className={styles.intro}>Use the phone number registered to your branch account. Your PIN is never shared with a client.</p>

      <label htmlFor="signin-phone" className={`${styles.label} ${styles.phoneLabel}`}>
        PHONE NUMBER
      </label>
      <input
        id="signin-phone"
        type="tel"
        inputMode="numeric"
        className={`${styles.input} ${styles.phoneInput}`}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="0753 000 034"
        required
        autoComplete="username"
      />

      <div className={styles.pinRow}>
        <label htmlFor="signin-pin" className={styles.label}>
          STAFF PIN
        </label>
        <button type="button" className={styles.showToggle} onClick={() => setPinShown((shown) => !shown)}>
          {pinShown ? "Hide" : "Show"}
        </button>
      </div>
      <input
        id="signin-pin"
        type={pinShown ? "text" : "password"}
        className={`${styles.input} ${styles.pinInput}`}
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="••••••"
        required
        autoComplete="current-password"
      />

      <div className={styles.keepRow}>
        <label className={styles.keep}>
          <input type="checkbox" className={styles.keepInput} checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          <span className={styles.checkbox} aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.6l3.1 3.1L13 4.8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Keep me signed in</span>
        </label>
        <button type="button" className={styles.forgot} onClick={showForgotPin}>
          Forgot PIN?
        </button>
      </div>

      <button type="submit" className={styles.submit} disabled={submitting}>
        {submitting ? "..." : "LOGIN"}
      </button>
    </form>
  );
}

export function FooterLinks() {
  return (
    <span className={styles.footerLinks}>
      <button type="button" onClick={() => void Swal.fire({ title: "Support", text: "For help with your account, contact your branch manager or the system administrator.", icon: "info", confirmButtonText: "Yes!" })}>
        SUPPORT
      </button>
      <button type="button" onClick={() => void Swal.fire({ title: "Terms", text: "This portal is for authorised M-Kopa Credit staff only. All activity is logged.", icon: "info", confirmButtonText: "Yes!" })}>
        TERMS
      </button>
    </span>
  );
}
