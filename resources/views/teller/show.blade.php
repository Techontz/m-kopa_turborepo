@extends('layouts.app')

@section('body_class', 'theme-orange font-ubuntu')

@section('breadcrumb')
    <li class="breadcrumb-item active">Teller</li>
    <li class="breadcrumb-item active">Customer Loan Information</li>
@endsection

@use('App\Enums\LoanStatus')

@php
    $isCashedOut = $loan && in_array($loan->status, [LoanStatus::Active, LoanStatus::Default, LoanStatus::Done, LoanStatus::WrittenOff], true);
    $paid = $loan ? $loan->paid_amount : 0;
    $dueTotal = $loan ? (float) $loan->total_payable + (float) $loan->insurance : 0;
@endphp

@section('content')
    <x-card class="text-center">
        <img src="{{ $customer->photo_url }}" class="img-thumbnail" style="width: 125px; height: 125px; object-fit: cover;" alt="">
        <p class="mt-2 mb-2" style="font-size: 12px; color: #000;">{{ strtoupper($customer->full_name) }}</p>
        @if ($loan && in_array($loan->status, [LoanStatus::Active, LoanStatus::Default], true))
            <a href="javascript:;" class="btn btn-sm btn-primary" data-toggle="modal" data-target="#addcontact1">Deposit</a>
        @endif
        @if ($loan && $loan->status === LoanStatus::Disbursed)
            <a href="javascript:;" class="btn btn-sm btn-warning" data-toggle="modal" data-target="#addcontact2">Withdrawal</a>
        @endif
    </x-card>

    <x-card>
        <div class="table-responsive">
            <table class="table table-custom">
                <thead class="thead-info">
                    <tr><th>Phone Number</th><th>Withdrawal Date</th><th>End Date</th><th>Loan Amount</th><th>Insurelance</th><th>Restoration</th><th>Amount Paid</th><th>Remaining debt</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{{ $customer->phone }}</td>
                        <td>{{ $loan?->withdrawn_at?->toDateString() ?? 'YY-MM-DD' }}</td>
                        <td>{{ $loan?->end_date?->toDateString() ?? 'YY-MM-DD' }}</td>
                        <td>{{ money($isCashedOut ? $loan->total_payable : 0) }}</td>
                        <td>{{ money($isCashedOut ? $loan->insurance : 0) }}</td>
                        <td>{{ money($isCashedOut ? $loan->restoration : 0) }}</td>
                        <td>{{ money($paid) }}</td>
                        <td>{{ money($isCashedOut ? max(0, $dueTotal - $paid) : 0) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </x-card>

    <div class="row">
        <div class="col-lg-6">
            <x-card>
                <table class="table table-custom mb-0">
                    <thead class="thead-info"><tr><th>Opening</th><th>Deposit</th><th>Withdrawal</th><th>Closing</th></tr></thead>
                    <tbody>
                        <tr>
                            <td>{{ money($cashbook['opening']) }}</td>
                            <td>{{ money($cashbook['deposit']) }}</td>
                            <td>{{ money($cashbook['withdrawal']) }}</td>
                            <td>{{ money($cashbook['opening'] + $cashbook['deposit'] - $cashbook['withdrawal']) }}</td>
                        </tr>
                    </tbody>
                </table>
            </x-card>
        </div>
    </div>

    <div class="row">
        <div class="col-md-3 mb-2">
            <select class="form-control select2 js-location-select">
                <option value="">Search Customer</option>
                @foreach ($customers as $option)
                    <option value="{{ route('teller.show', $option) }}">{{ $option->full_name }} / {{ $option->customer_code }}</option>
                @endforeach
            </select>
        </div>
    </div>

    <x-card>
        <div class="table-responsive">
            <table class="table table-custom">
                <thead class="thead-info"><tr><th>Date</th><th>Description</th><th>Deposit</th><th>Withdrawal</th><th>Balance</th><th>Remain Debit</th><th>Penalty</th></tr></thead>
                <tbody>
                    @foreach ($statement as $row)
                        <tr>
                            <td>{{ $row['date'] }}</td>
                            <td>{{ $row['description'] }}</td>
                            <td>{{ money($row['deposit']) }}</td>
                            <td>{{ money($row['withdrawal']) }}</td>
                            <td>{{ money($row['balance']) }}</td>
                            <td>{{ money($row['remain']) }}</td>
                            <td>{{ money($row['penalty']) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    @if ($loan && in_array($loan->status, [LoanStatus::Active, LoanStatus::Default], true))
        <x-modal id="addcontact1" :action="route('teller.deposit', $loan)" submit="Deposit">
            <div class="row">
                <div class="col-md-4"><span>Total Loan</span><input type="text" class="form-control" value="{{ money($dueTotal) }}" readonly></div>
                <div class="col-md-4"><span>Amount Paid</span><input type="text" class="form-control" value="{{ money($paid) }}" readonly></div>
                <div class="col-md-4"><span>Insurelance</span><input type="text" class="form-control" value="{{ money($loan->insurance) }}" readonly></div>
                <div class="col-md-4"><span>Remain Debit</span><input type="text" class="form-control" value="{{ money(max(0, $dueTotal - $paid)) }}" readonly></div>
                <div class="col-md-4"><span>Salary advance</span><input type="text" class="form-control" value="{{ money($deductions['salary_advance'] ?? 0) }}" readonly></div>
                <div class="col-md-4"><span>Recovery Amount</span><input type="text" class="form-control" value="0.00" readonly></div>
                <div class="col-md-4"><span>Penart</span><input type="text" class="form-control" value="{{ number_format($penalty, 2) }}" readonly></div>
                <div class="col-md-4"><span>Deposit Amount</span><input type="text" name="depost" class="form-control js-money-input" placeholder="Enter Deposit Amount" required autocomplete="off"></div>
                <div class="col-md-4">
                    <span>Select Account:</span>
                    <select name="p_method" class="form-control" required><option value="CASH">CASH</option></select>
                </div>
                <div class="col-md-12 mt-2">
                    <label class="fancy-checkbox"><input type="checkbox" name="recept" value="1"> <span>Print receipt</span></label>
                </div>
            </div>
        </x-modal>
    @endif

    @if ($loan && $loan->status === LoanStatus::Disbursed)
        <x-modal id="addcontact2" :action="route('teller.withdraw', $loan)" submit="Withdrawal">
            <p class="font-weight-bold">{{ strtoupper($customer->full_name) }}</p>
            <div class="row">
                <div class="col-md-6"><span>Remain Cash</span><input type="number" name="withdrow" class="form-control" value="{{ (int) ($deductions['remain_cash'] ?? 0) }}" readonly></div>
                <div class="col-md-6">
                    <span>Method</span>
                    <select name="method" class="form-control" required><option value="CASH">CASH</option></select>
                </div>
                <div class="col-md-6"><span>Date</span><input type="date" name="date_with" class="form-control" value="{{ now()->toDateString() }}" readonly required></div>
                <div class="col-md-6"><span>Code</span><input type="number" name="code" class="form-control" placeholder="Enter Code" required autocomplete="off"></div>
            </div>
        </x-modal>
    @endif
@endsection
