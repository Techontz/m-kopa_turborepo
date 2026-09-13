@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">{{ $approved ? 'Headquater Transaction Aproved' : 'Headquater Transaction requested' }}</li>
@endsection

@section('content')
    <x-card :title="$approved ? 'From Headquater Aproved Transaction - CEO ACC' : 'From Headquater Transaction - CEO ACC'">
        <x-slot:actions>
            @if ($approved)
                <x-header-button target="addcontact1" />
            @else
                <x-header-button target="addcontact1" icon="icon-pencil" />
            @endif
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>From Account</th>
                        <th>Amount</th>
                        <th>To Account</th>
                        <th>status</th>
                        <th>Staff Name</th>
                        <th>Charger</th>
                        @if ($approved)
                            <th>Aproved Date</th>
                        @else
                            <th>Date</th>
                            <th>Action</th>
                        @endif
                    </tr>
                </thead>
                <tbody>
                    @foreach ($transactions as $transaction)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ \App\Enums\Account::tryFrom($transaction->from_account)?->label() }}</td>
                            <td>{{ money($transaction->amount) }}</td>
                            <td>{{ \App\Enums\Account::tryFrom($transaction->to_account)?->label() }}</td>
                            <td>
                                @if ($transaction->status === 'approved')
                                    <span class="badge badge-success">Aproved</span>
                                @else
                                    <span class="badge badge-danger">Pending</span>
                                @endif
                            </td>
                            <td>{{ $transaction->employee?->full_name }}</td>
                            <td>{{ money($transaction->charge) }}</td>
                            @if ($approved)
                                <td>{{ $transaction->approved_at?->format('Y-m-d') }}</td>
                            @else
                                <td>{{ $transaction->created_at->format('Y-m-d') }}</td>
                                <td>
                                    <x-action-button :action="route('hq-transactions.approve', $transaction)" confirm="Are you sure?" icon="icon-like" class="btn btn-sm btn-icon btn-success" title="Aprove" />
                                </td>
                            @endif
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL:</b></td>
                        <td></td>
                        <td><b>{{ money($transactions->sum('amount')) }}</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td><b>{{ money($transactions->sum('charge')) }}</b></td>
                        <td></td>
                        @unless ($approved)
                            <td></td>
                        @endunless
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    @if ($approved)
        <x-date-range-filter id="addcontact1" :action="route('hq-transactions.approved')" />
    @else
        <x-modal id="addcontact1" title="Request Transaction" :action="route('hq-transactions.store')" submit="Request" size="">
            <div class="row clearfix">
                <div class="col-lg-6 col-6">
                    <div class="form-group">
                        <span>From Account:</span>
                        <select name="from_account" class="form-control" required>
                            <option value="">Select Account</option>
                            @foreach ($hqAccounts as $hqAccount)
                                <option value="{{ $hqAccount->value }}">{{ $hqAccount->label() }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
                <div class="col-lg-6 col-6">
                    <div class="form-group">
                        <span>To Account:</span>
                        <select name="to_account" class="form-control" required>
                            <option value="">Select Account</option>
                            @foreach ($hqAccounts as $hqAccount)
                                <option value="{{ $hqAccount->value }}">{{ $hqAccount->label() }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
                <div class="col-lg-6 col-6">
                    <div class="form-group">
                        <span>Amount:</span>
                        <input type="number" name="amount" class="form-control" placeholder="Amount" autocomplete="off" required>
                    </div>
                </div>
                <div class="col-lg-6 col-6">
                    <div class="form-group">
                        <span>Charger:</span>
                        <input type="number" name="charge" class="form-control" placeholder="Chargers Fee" autocomplete="off">
                    </div>
                </div>
            </div>
        </x-modal>
    @endif
@endsection
