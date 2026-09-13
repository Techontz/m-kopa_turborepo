@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Bank</li>
    <li class="breadcrumb-item active">Request Expenses</li>
@endsection

@section('content')
    <x-card title="Expenses List">
        <x-slot:actions>
            <x-header-button target="addcontact2" icon="icon-plus" />
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Expenses Name</th>
                        <th>Amount</th>
                        <th>From Account</th>
                        <th>Comment</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($expenseRequests as $expenseRequest)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $expenseRequest->expenseType?->name }}</td>
                            <td>{{ money($expenseRequest->amount) }}</td>
                            <td>{{ $expenseRequest->bankAccount?->name }}</td>
                            <td>{{ $expenseRequest->comment }}</td>
                            <td>{{ $expenseRequest->request_date->format('Y-m-d') }}</td>
                            <td class="text-nowrap">
                                @if ($expenseRequest->status === 'pending')
                                    <x-action-button :action="route('expense-requests.accept', $expenseRequest)" confirm="Are you sure?" icon="icon-like" class="btn btn-sm btn-icon btn-success" title="Accept" />
                                    <x-action-button :action="route('expense-requests.destroy', $expenseRequest)" method="DELETE" confirm="Are you sure?" icon="icon-trash" />
                                @else
                                    <span class="badge badge-success">Accepted</span>
                                @endif
                            </td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td>TOTAL:</td>
                        <td></td>
                        <td><b>{{ money($expenseRequests->sum('amount')) }}</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" title="Register Expenses" :action="route('expense-requests.store')" submit="Save" size="">
        <input type="hidden" name="scope" value="bank">
        <div class="row clearfix">
            <div class="col-lg-6">
                <label class="form-control-label">Select Account:</label>
                <select name="ac_id" class="form-control" required>
                    <option value="">Select Account</option>
                    @foreach ($bankAccounts as $bankAccount)
                        <option value="{{ $bankAccount->id }}">{{ $bankAccount->name }} - {{ money($bankAccount->balance()) }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-lg-6">
                <label class="form-control-label">*Expenses:</label>
                <select name="exp_id" class="form-control" required>
                    <option value="">Select Expenses</option>
                    @foreach ($expenseTypes as $expenseType)
                        <option value="{{ $expenseType->id }}">{{ $expenseType->name }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-lg-12">
                <label class="form-control-label">*Amount:</label>
                <input type="number" name="amount" class="form-control" placeholder="Enter Amount" required>
            </div>
            <div class="col-lg-12">
                <label class="form-control-label">*Comment:</label>
                <textarea name="comment" class="form-control" rows="3" placeholder="Enter Comment" required></textarea>
            </div>
        </div>
    </x-modal>
@endsection
