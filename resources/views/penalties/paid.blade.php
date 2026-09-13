@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Penarty</li>
    <li class="breadcrumb-item active">Paid Penarty List</li>
@endsection

@section('content')
    <x-card title="Paid Penarty List">
        <x-slot:actions>
            <x-header-button target="addcontact1" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Customer Name</th>
                        <th>Branch Name</th>
                        <th>Paid Amount</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($payments as $payment)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $payment->penalty->customer?->full_name }}</td>
                            <td>{{ $payment->penalty->branch?->name }}</td>
                            <td>{{ money($payment->amount) }}</td>
                            <td>{{ $payment->paid_on->format('Y-m-d') }}</td>
                            <td></td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <th>TOTAL</th>
                        <th></th>
                        <th></th>
                        <th><b>{{ money($payments->sum('amount')) }}</b></th>
                        <th></th>
                        <th></th>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-date-range-filter id="addcontact1" :action="route('penalties.paid')" :branches="$branches" all-label="All" :dates-required="false" />
@endsection
