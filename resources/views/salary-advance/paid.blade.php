@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Salary Advance paid list</li>
@endsection

@section('content')
    <x-card title="Salary Advance Paid List">
        <x-slot:actions>
            <x-header-button target="addcontact1" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Branch</th>
                        <th>Customer Name</th>
                        <th>Amount</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($payments as $payment)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $payment->salaryAdvance->branch?->name }}</td>
                            <td>{{ $payment->salaryAdvance->customer?->full_name }}</td>
                            <td>{{ money($payment->amount) }}</td>
                            <td>{{ $payment->paid_on->format('Y-m-d') }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL:</b></td>
                        <td></td>
                        <td></td>
                        <td><b>{{ money($payments->sum('amount')) }}</b></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-date-range-filter id="addcontact1" :action="route('salary-advances.paid')" :branches="$branches" branch-placeholder="select branch" />
@endsection
