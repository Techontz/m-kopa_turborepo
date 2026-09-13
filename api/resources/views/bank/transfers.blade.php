@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Bank</li>
    <li class="breadcrumb-item active">Bank Transaction list</li>
@endsection

@section('content')
    <x-card title="Transaction list">
        <x-slot:actions>
            <x-header-button target="addcontact2" icon="icon-pencil" />
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>From Branch</th>
                        <th>From A/c</th>
                        <th>Amount</th>
                        <th>To A/C</th>
                        <th>status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($transfers as $transfer)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $transfer->branch?->name }}</td>
                            <td>{{ \App\Enums\Account::tryFrom((string) $transfer->branch_account)?->label() }}</td>
                            <td>{{ money($transfer->amount) }}</td>
                            <td>{{ $transfer->bankAccount?->name }}</td>
                            <td><span class="badge badge-danger">Pending</span></td>
                            <td>{{ $transfer->transfer_date->format('Y-m-d') }}</td>
                            <td class="text-nowrap">
                                <x-action-button :action="route('bank-transfers.approve', $transfer)" confirm="Are you sure?" icon="icon-like" class="btn btn-sm btn-icon btn-success" title="Aprove" />
                                <x-action-button :action="route('bank-transfers.destroy', $transfer)" method="DELETE" confirm="Are you sure?" icon="icon-trash" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td>TOTAL:</td>
                        <td></td>
                        <td></td>
                        <td><b>{{ money($transfers->sum('amount')) }}</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" title="Transfer Amount From Branch To Bank" :action="route('bank-transfers.store')" submit="Transfar" size="">
        <div class="row clearfix">
            <div class="col-lg-6 col-6">
                <span>From Branch</span>
                <x-branch-select :branches="$branches" name="from_blanch_id" placeholder="Select branch" />
            </div>
            <div class="col-lg-6 col-6">
                <span>Branch Account</span>
                <select name="ac_type" class="form-control" required>
                    <option value="">Select Account</option>
                    @foreach ($branchAccounts as $branchAccount)
                        <option value="{{ $branchAccount->value }}" @selected(old('ac_type') === $branchAccount->value)>{{ $branchAccount->label() }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-lg-6 col-6">
                <span>Amount</span>
                <input type="number" name="amount" class="form-control" placeholder="Enter Amount" value="{{ old('amount') }}" required>
            </div>
            <div class="col-lg-6 col-6">
                <span>Bank Account Name</span>
                <select name="to_account_id" class="form-control" required>
                    <option value="">Select Account</option>
                    @foreach ($bankAccounts as $bankAccount)
                        <option value="{{ $bankAccount->id }}" @selected((string) old('to_account_id') === (string) $bankAccount->id)>{{ $bankAccount->name }}</option>
                    @endforeach
                </select>
            </div>
        </div>
    </x-modal>
@endsection
