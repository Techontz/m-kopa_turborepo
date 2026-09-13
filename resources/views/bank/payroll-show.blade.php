@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Bank</li>
    <li class="breadcrumb-item active">Payrol paid</li>
@endsection

@push('styles')
    <style>
        .thead-payroll th { background-color: #dddddd; color: #333; }
    </style>
@endpush

@section('content')
    <x-card :title="'Payrol paid Date: '.$date">
        <x-slot:actions>
            <li><a href="{{ route('payroll.index') }}" class="btn btn-sm btn-primary"><i class="icon-arrow-left-circle"></i></a></li>
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-payroll">
                    <tr>
                        <th>S/No.</th>
                        <th>Staff name</th>
                        <th>Sallary Amount</th>
                        <th>Sallary Advance</th>
                        <th>Allowance</th>
                        <th>Deduction</th>
                        <th>Loan Restration</th>
                        <th>Take Home</th>
                        <th>Phone no</th>
                        <th>Account name</th>
                        <th>Account no</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($payments as $payment)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $payment->employee?->full_name }}</td>
                            <td>{{ money($payment->salary) }}</td>
                            <td>{{ money($payment->salary_advance) }}</td>
                            <td>{{ money($payment->allowance) }}</td>
                            <td>{{ money($payment->deduction) }}</td>
                            <td>{{ money($payment->loan_restoration) }}</td>
                            <td>{{ money($payment->take_home) }}</td>
                            <td>{{ $payment->phone }}</td>
                            <td>{{ $payment->account_name }}</td>
                            <td>{{ $payment->account_number }}</td>
                            <td>{{ $payment->created_at?->format('Y-m-d H:i:s') }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL:</b></td>
                        <td></td>
                        <td><b>{{ money($payments->sum('salary')) }}</b></td>
                        <td><b>{{ money($payments->sum('salary_advance')) }}</b></td>
                        <td><b>{{ money($payments->sum('allowance')) }}</b></td>
                        <td><b>{{ money($payments->sum('deduction')) }}</b></td>
                        <td><b>{{ money($payments->sum('loan_restoration')) }}</b></td>
                        <td><b>{{ money($payments->sum('take_home')) }}</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>
@endsection
