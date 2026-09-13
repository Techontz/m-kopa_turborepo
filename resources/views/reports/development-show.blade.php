@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Teller</li>
    <li class="breadcrumb-item active">Customer Development</li>
@endsection

@php
    use App\Services\Reports\LoanReports;
@endphp

@push('styles')
    <style>
        .development-photo { text-align: center; }
        .development-photo img { width: 135px; height: 135px; object-fit: cover; }
        .development-photo small { display: block; margin-top: 8px; font-size: 10px; }
    </style>
@endpush

@section('content')
    <div class="card">
        <div class="body development-photo">
            <img src="{{ $customer->photo_url }}" class="img-thumbnail" alt="customer image">
            <small>{{ $customer->full_name }}</small>
        </div>
    </div>

    <div class="card">
        <div class="body">
            <div class="text-right mb-2">
                @if ($customer->is_marked)
                    <x-action-button :action="route('customers.mark', $customer)" confirm="Are you sure to Un mark?" class="btn btn-success" icon="icon-trash">Un- mark</x-action-button>
                @endif
                <a href="{{ route('reports.development') }}" class="btn btn-primary btn-sm"><i class="icon-arrow-left"></i></a>
            </div>
            <div class="table-responsive">
                <table class="table table-hover dataTable table-custom" data-no-datatable>
                    <thead class="thead-info">
                        <tr>
                            <th>Phone Number</th>
                            <th>Withdrawal Date</th>
                            <th>End Date</th>
                            <th>Loan Amount</th>
                            <th>Restoration</th>
                            <th>Amount Paid</th>
                            <th>Remaining debt</th>
                            <th>Salary Advance</th>
                            <th>Penalty</th>
                            <th>Recovery Amount</th>
                            <th>Loan Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{{ $customer->phone }}</td>
                            <td>{{ $latest?->withdrawn_at?->format('Y-m-d') }}</td>
                            <td>{{ $latest?->end_date?->format('Y-m-d') }}</td>
                            <td>{{ money($latest?->total_payable) }}</td>
                            <td>{{ money($latest?->restoration) }}</td>
                            <td>{{ money($latest?->paid_sum) }}</td>
                            <td>{{ money($latest ? LoanReports::remaining($latest) : 0) }}</td>
                            <td>{{ money($salary_advance) }}</td>
                            <td>{{ money($penalty) }}</td>
                            <td>{{ money($recovery) }}</td>
                            <td>
                                @if ($latest)
                                    <a href="javascript:;" class="badge badge-{{ $latest->status->badge() }}">{{ $latest->status->label() }}</a>
                                @endif
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <x-card title="All Loans">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Loan Ac</th>
                        <th>Loan Product</th>
                        <th>Loan Interest</th>
                        <th>Loan Withdrawal</th>
                        <th>Principal + interest</th>
                        <th>Duration Type</th>
                        <th>Number of Repayment</th>
                        <th>Restoration</th>
                        <th>Status</th>
                        <th>Withdrawal Date</th>
                        <th>End Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($loans as $loan)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $loan->loan_number }}</td>
                            <td>{{ $loan->category?->name }}</td>
                            <td>{{ (float) $loan->interest_rate }}%</td>
                            <td>{{ money($loan->amount_approved ?: $loan->amount_applied) }}</td>
                            <td>{{ money($loan->total_payable) }}</td>
                            <td>{{ $loan->duration->label() }}</td>
                            <td>{{ $loan->sessions }}</td>
                            <td>{{ money($loan->restoration) }}</td>
                            <td><a href="javascript:;" class="badge badge-{{ $loan->status->badge() }}">{{ $loan->status->label() }}</a></td>
                            <td>{{ $loan->withdrawn_at?->format('Y-m-d') }}</td>
                            <td>{{ $loan->end_date?->format('Y-m-d') }}</td>
                            <td><a href="{{ route('reports.statement', ['customer_id' => $customer->id, 'loan_id' => $loan->id]) }}" target="_blank" class="btn btn-sm btn-primary"><i class="icon-printer"></i></a></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
