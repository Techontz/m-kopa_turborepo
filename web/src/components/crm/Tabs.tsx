"use client";

/** Live pill tabs (`ul.nav.nav-tabs-new.profile-tabs`) as used on the customer profile. */
export function PillTabs<T extends string>({ tabs, value, onChange }: { tabs: Array<[T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <ul className="nav nav-tabs-new profile-tabs">
      {tabs.map(([key, label]) => (
        <li className="nav-item" key={key}>
          <a
            href="#"
            className={value === key ? "active" : ""}
            onClick={(event) => {
              event.preventDefault();
              onChange(key);
            }}
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Coloured summary tile like the dashboard cards (`.body.dashboard-stat`). */
export function StatTile({ tone, icon, value, label, onClick }: { tone: "success" | "warning" | "primary" | "danger" | "info"; icon: string; value: string | number; label: string; onClick?: () => void }) {
  const tile = (
    <div className={`body dashboard-stat bg-${tone} text-light`}>
      <h4><i className={icon} /> {value}</h4>
      <span>{label}</span>
    </div>
  );

  return (
    <div className="col-lg-3 col-md-6 mb-2">
      {onClick ? (
        <a href="#" onClick={(event) => { event.preventDefault(); onClick(); }}>{tile}</a>
      ) : (
        tile
      )}
    </div>
  );
}
