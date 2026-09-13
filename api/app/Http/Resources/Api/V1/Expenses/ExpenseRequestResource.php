<?php

namespace App\Http\Resources\Api\V1\Expenses;

use App\Enums\Account;
use App\Models\ExpenseRequest;
use App\Services\ExpenseApproval;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * @mixin ExpenseRequest
 */
class ExpenseRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $required = app(ExpenseApproval::class)->requiredPermissions($this->resource, (float) $this->amount);

        return [
            'id' => $this->id,
            'scope' => $this->scope,
            'branch_id' => $this->branch_id,
            'branch' => $this->branch?->name,
            'expense_type_id' => $this->expense_type_id,
            'expense' => $this->expenseType?->name,
            'bank_account_id' => $this->bank_account_id,
            'bank_account' => $this->bankAccount?->name,
            'amount' => (float) $this->amount,
            'description' => $this->description,
            'comment' => $this->comment,
            'status' => $this->status,
            'staff' => $this->employee?->full_name,
            'request_date' => $this->request_date?->toDateString(),
            'paid_from_account' => $this->paid_from_account,
            'paid_from' => $this->paid_from_account ? Account::tryFrom($this->paid_from_account)?->label() : null,
            'approved_by' => $this->approver?->full_name,
            'approved_at' => $this->approved_at?->toDateString(),
            'approval_level' => in_array('expenses.approve_branch', $required, true) ? 'finance' : 'admin',
            'can_approve' => $this->status === 'pending' && collect($required)->contains(fn (string $permission): bool => Gate::allows($permission)),
        ];
    }
}
