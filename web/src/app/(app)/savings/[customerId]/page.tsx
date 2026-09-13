"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import type { SavingTransaction } from "@/components/finance-b/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface CustomerSaving {
  customer: { id: number; full_name: string; phone: string; photo_url: string; branch: string | null };
  total_saving: number;
  statement: SavingTransaction[];
}

interface WithdrawalForm {
  with_sav: string;
  action: string;
  method: string;
}

export default function CustomerSavingPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { data, isLoading } = useApi<CustomerSaving>(`savings/customers/${customerId}`);
  const [modal, setModal] = useState<"deposit" | "withdrawal" | null>(null);
  const [depSav, setDepSav] = useState("");
  const [withdrawal, setWithdrawal] = useState<WithdrawalForm>({ with_sav: "", action: "", method: "" });

  const deposit = useAction<{ dep_sav: string }>("post", `savings/customers/${customerId}/deposits`);
  const withdraw = useAction<WithdrawalForm>("post", `savings/customers/${customerId}/withdrawals`);
  const reverse = useAction<{ id: number; reason: string }>("post", (body) => `savings/transactions/${body.id}/reverse`);

  const customer = data?.customer;

  return (
    <>
      <PageHeader crumbs={["Saving", "Saving Deposit"]} />

      <div className="card">
        <div className="row profile_state">
          <div className="col-lg-2 col-2" />
          <div className="col-lg-8 col-8">
            <div className="body text-center">
              {customer && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={customer.photo_url} className="img-thumbnail" alt="customer image" style={{ width: 135, height: 135, objectFit: "cover" }} />
              )}
              <div><small>{customer?.full_name}</small></div>
            </div>
          </div>
          <div className="col-lg-2 col-2" />
        </div>
      </div>

      <Card>
        <div className="table-responsive">
          <table className="table table-hover dataTable table-custom">
            <thead className="thead-info">
              <tr>
                <th>Phone Number</th>
                <th>Total saving</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{customer?.phone}</td>
                <td>{money(data?.total_saving)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="m-b-10" style={{ width: 330, maxWidth: "100%" }}>
        <SelectBox placeholder="Select customer" optionsUrl="options/customers" onChange={(value) => value && router.push(`/savings/${value}`)} />
      </div>

      <Card>
        <div className="text-right m-b-10">
          <button type="button" className="btn btn-primary mr-1" onClick={() => setModal("deposit")}><i className="icon-pencil" />Deposit</button>
          <button type="button" className="btn btn-success" onClick={() => setModal("withdrawal")}><i className="icon-pencil" />Withdrawal</button>
        </div>
        <DataTable
          rows={data?.statement}
          loading={isLoading}
          searchable={false}
          pageSize={1000}
          rowKey={(row) => row.id}
          columns={[
            { key: "transaction_date", header: "Date", sortable: false },
            { key: "description", header: "Description", sortable: false, render: (row) => (row.reversed ? <>{row.description} <Badge tone="danger">REVERSED</Badge></> : row.description) },
            { key: "deposit", header: "Deposit", sortable: false, render: (row) => (row.type === "deposit" ? money(row.amount) : "") },
            { key: "withdrawal", header: "Withdrawal", sortable: false, render: (row) => (row.type === "withdrawal" ? money(row.amount) : "") },
            { key: "balance", header: "Balance", sortable: false, render: (row) => money(row.balance) },
            ...(can("accounting.reverse")
              ? [{
                  key: "action",
                  header: "Action",
                  sortable: false,
                  render: (row: SavingTransaction) =>
                    !row.reversed && row.withdrawal_type !== "CLEAR" ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-icon btn-danger"
                        title="Reverse"
                        onClick={async () => {
                          const reason = await promptReason("Reason for reversal");
                          if (reason) {
                            reverse.mutate({ id: row.id, reason });
                          }
                        }}
                      >
                        <i className="icon-action-undo" />
                      </button>
                    ) : null,
                }]
              : []),
          ]}
        />
      </Card>

      <Modal
        open={modal === "deposit"}
        onClose={() => setModal(null)}
        title={<>{customer?.full_name}<br />Total saving:  {money(data?.total_saving)}</>}
        submitLabel="Deposit"
        submitting={deposit.isPending}
        onSubmit={async () => {
          if (await confirmAction("Are you Sure To Deposit Again?")) {
            deposit.mutate({ dep_sav: depSav }, { onSuccess: () => { setDepSav(""); setModal(null); } });
          }
        }}
      >
        <div className="row clearfix">
          <Field label="Amount" className="col-md-12 col-12" error={deposit.fieldError("dep_sav")}>
            <input type="number" className="form-control" placeholder="Enter  Amount" min={1} required style={{ color: "green" }} value={depSav} onChange={(e) => setDepSav(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={modal === "withdrawal"}
        onClose={() => setModal(null)}
        title={customer?.full_name}
        submitLabel="Withdrawal"
        submitting={withdraw.isPending}
        onSubmit={() => withdraw.mutate(withdrawal, { onSuccess: () => { setWithdrawal({ with_sav: "", action: "", method: "" }); setModal(null); } })}
      >
        <div className="row clearfix">
          <Field label="Withdrawal Amount" className="col-md-6 col-6" error={withdraw.fieldError("with_sav")}>
            <input type="number" className="form-control" placeholder="Enter Amount" required value={withdrawal.with_sav} onChange={(e) => setWithdrawal({ ...withdrawal, with_sav: e.target.value })} />
          </Field>
          <Field label="withdrawal by:" className="col-md-6 col-6" error={withdraw.fieldError("action")}>
            <select className="form-control" required value={withdrawal.action} onChange={(e) => setWithdrawal({ ...withdrawal, action: e.target.value, method: "" })}>
              <option value="">---Select---</option>
              <option value="TAKEN">TAKEN</option>
              <option value="CLEAR">CLEAR LOAN</option>
            </select>
          </Field>
          {withdrawal.action === "CLEAR" && (
            <Field label="Account:" className="col-md-12 col-12" error={withdraw.fieldError("method")}>
              <select className="form-control" value={withdrawal.method} onChange={(e) => setWithdrawal({ ...withdrawal, method: e.target.value })}>
                <option value="">---Select Account---</option>
                <option value="CASH">CASH</option>
              </select>
            </Field>
          )}
        </div>
      </Modal>
    </>
  );
}
