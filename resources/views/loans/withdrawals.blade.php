@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">Loan Withdrawal</li>
@endsection

@section('content')
    <div class="card">
        <div class="body">
            <ul class="nav nav-tabs-new profile-tabs">
                @foreach ($groups->keys() as $label)
                    <li class="nav-item"><a class="nav-link {{ $loop->first ? 'active' : '' }}" data-toggle="tab" href="#withdrawal-{{ strtolower($label) }}">{{ $label }}</a></li>
                @endforeach
                <li class="nav-item"><a class="nav-link" href="{{ route('dashboard') }}">Back</a></li>
            </ul>
        </div>
    </div>

    <div class="tab-content">
        @foreach ($groups as $label => $loans)
            <div class="tab-pane {{ $loop->first ? 'active' : '' }}" id="withdrawal-{{ strtolower($label) }}">
                <x-card :title="$label === 'All' ? 'All Loan withdrawal' : $label">
                    <x-slot:actions>
                        <x-header-button target="addcontact2" />
                    </x-slot:actions>
                    <div class="table-responsive">
                        <table class="table table-hover js-basic-example dataTable table-custom">
                            <thead class="thead-info">
                                <tr>
                                    <th>Customer Name</th>
                                    <th>Branch Name</th>
                                    <th>Loan Ac</th>
                                    <th>Loan Withdrawal</th>
                                    <th>Interest</th>
                                    <th>Principal + Interest</th>
                                    <th>Method</th>
                                    <th>Duration Type</th>
                                    <th>Number of Repayment</th>
                                    <th>Restoration</th>
                                    <th>Loan fee</th>
                                    <th>Withdrawal Date</th>
                                    <th>End Date</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($loans as $loan)
                                    <tr>
                                        <td>{{ $loan->customer->full_name }}</td>
                                        <td>{{ $loan->branch->name }}</td>
                                        <td>{{ $loan->loan_number }}</td>
                                        <td>{{ money($loan->amount_approved) }}</td>
                                        <td>{{ rtrim(rtrim(number_format((float) $loan->interest_rate, 2), '0'), '.') }}%</td>
                                        <td>{{ money($loan->total_payable) }}</td>
                                        <td>CASH</td>
                                        <td>{{ $loan->duration->label() }}</td>
                                        <td>{{ $loan->sessions }}</td>
                                        <td>{{ money($loan->restoration) }}</td>
                                        <td>{{ money($loan->fee_deduct ? $loan->loan_fee : 0) }}</td>
                                        <td>{{ $loan->withdrawn_at?->toDateString() }}</td>
                                        <td>{{ $loan->end_date?->toDateString() }}</td>
                                        <td><a href="{{ route('loans.show', $loan) }}" class="btn btn-sm btn-primary"><i class="icon-eye"></i></a></td>
                                    </tr>
                                @endforeach
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th>TOTAL:</th><th></th><th></th>
                                    <th>{{ money($loans->sum('amount_approved')) }}</th>
                                    <th></th>
                                    <th>{{ money($loans->sum('total_payable')) }}</th>
                                    <th></th><th></th><th></th><th></th>
                                    <th>{{ money($loans->where('fee_deduct', true)->sum('loan_fee')) }}</th>
                                    <th></th><th></th><th></th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </x-card>
            </div>
        @endforeach
    </div>

    <x-date-range-filter id="addcontact2" :action="route('loans.withdrawal')" :branches="$branches">
        <div class="col-md-12 mb-2">
            <select name="loan_status" class="form-control" required>
                <option value="">Select Loan Status</option>
                <option value="pending">PENDING</option>
                <option value="disbursed">APROVED</option>
                <option value="disbursed">DISBURSED</option>
                <option value="active">ACTIVE</option>
                <option value="done">DONE</option>
                <option value="default">DEFALT</option>
                <option value="all">ALL</option>
            </select>
        </div>
    </x-date-range-filter>
@endsection
