"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Loading } from "@/components/ui/Loading";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T, index: number) => ReactNode;
  /** Value used for search and sorting; defaults to row[key]. */
  value?: (row: T) => string | number | null | undefined;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  rowKey?: (row: T, index: number) => string | number;
  footer?: ReactNode;
  pageSize?: number;
  searchable?: boolean;
  headClassName?: string;
  emptyMessage?: ReactNode;
}

/**
 * Client-side table with the live DataTables behaviour: "Show N entries", "Search:",
 * sortable headers, "Showing x to y of z entries" and Previous / pages / Next.
 */
export function DataTable<T>({
  columns,
  rows,
  loading,
  rowKey,
  footer,
  pageSize: initialPageSize = 10,
  searchable = true,
  headClassName = "thead-info",
  emptyMessage = "No data available in table",
}: DataTableProps<T>) {
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const cellValue = (column: Column<T>, row: T) => (column.value ? column.value(row) : (row as Record<string, unknown>)[column.key]) as string | number | null | undefined;

  const filtered = useMemo(() => {
    let list = rows ?? [];
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((row) => columns.some((column) => String(cellValue(column, row) ?? "").toLowerCase().includes(term)));
    }
    if (sort) {
      const column = columns.find((item) => item.key === sort.key);
      if (column) {
        list = [...list].sort((a, b) => {
          const left = cellValue(column, a) ?? "";
          const right = cellValue(column, b) ?? "";
          const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true });
          return sort.direction === "asc" ? result : -result;
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const toggleSort = (key: string) => {
    setSort((current) => (current?.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  };

  const pageNumbers = Array.from({ length: pages }, (_, index) => index + 1).filter((number) => number === 1 || number === pages || Math.abs(number - currentPage) <= 2);

  return (
    <div className="dataTables_wrapper">
      {searchable && (
        <div className="mf-table-controls">
          <label className="mb-0">
            Show
            <select className="form-control" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            entries
          </label>
          <label className="mb-0">
            Search:
            <input type="search" className="form-control" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </label>
        </div>
      )}
      <div className="table-responsive">
        <table className="table table-hover dataTable table-custom mf-table">
          <thead className={headClassName}>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`${column.sortable === false ? "" : "sortable"} ${column.className ?? ""}`} onClick={() => column.sortable !== false && toggleSort(column.key)}>
                  {column.header}
                  {sort?.key === column.key ? (sort.direction === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} className="mf-loading"><Loading inline /></td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center">{emptyMessage}</td></tr>
            ) : (
              visible.map((row, index) => (
                <tr key={rowKey ? rowKey(row, index) : index}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.className}>
                      {column.render ? column.render(row, start + index) : String(cellValue(column, row) ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      {searchable && (
        <div className="mf-table-footer">
          <div>
            Showing {filtered.length === 0 ? 0 : start + 1} to {Math.min(start + pageSize, filtered.length)} of {filtered.length} entries
          </div>
          <ul className="pagination">
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button type="button" className="page-link" onClick={() => setPage(currentPage - 1)}>Previous</button>
            </li>
            {pageNumbers.map((number) => (
              <li key={number} className={`page-item ${number === currentPage ? "active" : ""}`}>
                <button type="button" className="page-link" onClick={() => setPage(number)}>{number}</button>
              </li>
            ))}
            <li className={`page-item ${currentPage === pages ? "disabled" : ""}`}>
              <button type="button" className="page-link" onClick={() => setPage(currentPage + 1)}>Next</button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
