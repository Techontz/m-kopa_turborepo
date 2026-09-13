@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">Loan Repayment</li>
@endsection

@section('content')
    <x-card title="Loan Repayment">
        <x-slot:actions>
            <x-header-button target="addcontact1" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th><b>Customer Name</b></th>
                        <th><b>Branch Name</b></th>
                        <th><b>Loan Ac</b></th>
                        <th><b>Principal</b></th>
                        <th><b>Interest Amount</b></th>
                        <th><b>Principal + Interest</b></th>
                        <th><b>Loan Duration</b></th>
                        <th><b>Number Of Repayment</b></th>
                        <th><b>Withdrawal Date</b></th>
                        <th><b>End Date</b></th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($loans as $loan)
                        <tr>
                            <td>{{ $loan->customer->full_name }}</td>
                            <td>{{ $loan->branch->name }}</td>
                            <td>{{ $loan->loan_number }}</td>
                            <td>{{ money($loan->amount_approved) }}</td>
                            <td>{{ money($loan->interest_amount) }}</td>
                            <td>{{ money($loan->total_payable) }}</td>
                            <td>{{ $loan->duration->label() }}</td>
                            <td>{{ $loan->sessions }}</td>
                            <td>{{ $loan->withdrawn_at?->format('Y-m-d') }}</td>
                            <td>{{ $loan->end_date?->format('Y-m-d') }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <th><b>TOTAL</b></th>
                        <th></th>
                        <th></th>
                        <th><b>{{ money($loans->sum('amount_approved')) }}</b></th>
                        <th><b>{{ money($loans->sum('interest_amount')) }}</b></th>
                        <th><b>{{ money($loans->sum('total_payable')) }}</b></th>
                        <th></th>
                        <th></th>
                        <th></th>
                        <th></th>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    @include('reports.partials.branch-filter', ['id' => 'addcontact1', 'title' => 'Filter Loan Repayment', 'action' => route('reports.repayment'), 'placeholder' => '---Select Branch---'])
@endsection
