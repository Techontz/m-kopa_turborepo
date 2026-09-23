import { Source_Serif_4 } from "next/font/google";

import { apiUrl } from "@/lib/session";

import { FooterLinks, LoginForm } from "./LoginForm";
import styles from "./login.module.css";

const serif = Source_Serif_4({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"] });

type LoginStats = { active_loans: number; on_time_repayment: number | null; branches: number };

/** Counts shown under the picture (GET auth/login-stats, public). The page still renders if the API is down. */
async function loginStats(): Promise<LoginStats | null> {
  try {
    const response = await fetch(apiUrl("auth/login-stats"), { headers: { Accept: "application/json" }, cache: "no-store" });
    return response.ok ? ((await response.json()).data as LoginStats) : null;
  } catch {
    return null;
  }
}

/** Staff login, built to the Claude Design "M-Kopa Staff Login" (1530 × 1028 canvas; stacks below 1100px). */
export default async function LoginPage() {
  const stats = await loginStats();
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dar_es_Salaam" }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  const today = `${parts.weekday} ${parts.day} ${parts.month.slice(0, 3)} ${parts.year}`.toUpperCase();

  return (
    <div className={`${styles.page} ${serif.className}`}>
      <div className={styles.frame}>
        <div className={styles.header}>
          <div className={styles.brand}>
            M&#8211;Kopa<em>Credit</em>
          </div>
          <div className={styles.tagline}>WEWE KWANZA</div>
          <div className={styles.portal}>
            STAFF PORTAL
            <br />
            {today}
          </div>
        </div>

        <LoginForm />

        <div className={styles.footer}>
          <span>M-KOPA MICROFINANCE &copy; {now.getFullYear()}</span>
          <FooterLinks />
        </div>

        <div className={styles.aside}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static design panel */}
          <img src="/assets/img/login-panel.png" alt="Empowering Communities Through Finance" className={styles.panel} />
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statValue}>{stats ? stats.active_loans.toLocaleString("en-US") : "—"}</div>
              <div className={styles.statLabel}>ACTIVE LOANS</div>
            </div>
            <div className={`${styles.stat} ${styles.statMiddle}`}>
              <div className={styles.statValue}>
                {stats?.on_time_repayment != null ? (
                  <>
                    {stats.on_time_repayment}
                    <span className={styles.statPercent}>%</span>
                  </>
                ) : (
                  "—"
                )}
              </div>
              <div className={styles.statLabel}>ON-TIME REPAYMENT</div>
            </div>
            <div className={styles.stat}>
              <div className={`${styles.statValue} ${styles.statRed}`}>{stats ? stats.branches.toLocaleString("en-US") : "—"}</div>
              <div className={styles.statLabel}>BRANCHES</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
