import { backendUrl } from "@/lib/api";

import styles from "./AssetLabel.module.css";
import { labelLines, type AssetRow } from "./assets";

/** Printable asset label: brand, Asset ID, name, type, QR code, branch and serial / registration where present. */
export function AssetLabel({ asset }: { asset: Pick<AssetRow, "asset_code" | "name" | "asset_type_label" | "branch" | "identifiers" | "qr_endpoint"> }) {
  const lines = labelLines(asset);

  return (
    <div className={styles.label} data-testid="asset-label">
      {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image stream */}
      <img className={styles.qr} src={backendUrl(asset.qr_endpoint)} alt={`QR code ${lines.code}`} />
      <div className={styles.text}>
        <div className={styles.brand}>{lines.brand}</div>
        <div className={styles.code}>{lines.code}</div>
        <div className={styles.line}><b>{lines.name}</b></div>
        <div className={styles.line}>{lines.type}</div>
        <div className={styles.line}>Branch: {lines.branch}</div>
        {lines.identifier && <div className={styles.line}>{lines.identifier.label}: {lines.identifier.value}</div>}
      </div>
    </div>
  );
}

export const labelSheetClass = styles.sheet;
