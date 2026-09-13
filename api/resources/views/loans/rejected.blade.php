@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan</li>
    <li class="breadcrumb-item active">Loan Rejected</li>
@endsection

@section('content')
    <x-card title="Loan Rejected">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Branch</th>
                        <th>Loan AC/No</th>
                        <th>customer name</th>
                        <th>Phone Number</th>
                        <th>Branch</th>
                        <th>Loan Amount</th>
                        <th>Loan Duration</th>
                        <th>Number of repayments</th>
                        <th>Loan Status</th>
                        <th>Customer Status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($loans as $loan)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $loan->branch->name }}</td>
                            <td>{{ $loan->loan_number }}</td>
                            <td>{{ $loan->customer->full_name }}</td>
                            <td>{{ $loan->customer->phone }}</td>
                            <td>{{ $loan->branch->name }}</td>
                            <td>{{ money($loan->amount_applied) }}</td>
                            <td>{{ $loan->duration->label() }}</td>
                            <td>{{ $loan->sessions }}</td>
                            <td><span class="badge badge-danger">REJECTED</span></td>
                            <td><span class="badge badge-info">{{ $loan->customer->status_label }}</span></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
