@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">Cash Transaction</li>
@endsection

@section('content')
    <x-card title="Transaction list">
        <x-slot:actions>
            <x-header-button target="addcontact2" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Customer Name</th>
                        <th>Deposit</th>
                        <th>Withdrawal</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($transactions as $transaction)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $transaction->customer?->full_name }}</td>
                            <td>{{ $transaction->type === 'deposit' ? money($transaction->amount) : '-' }}</td>
                            <td>{{ $transaction->type === 'withdrawal' ? money($transaction->amount) : '-' }}</td>
                            <td>{{ $transaction->transaction_date->format('Y-m-d') }}</td>
                            <td>
                                {{-- Live links this button to a hard delete of the transaction; kept visible but disabled here. --}}
                                <button type="button" class="btn btn-info btn-sm" disabled title="Not available"><i class="icon-pencil"></i></button>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <th>TOTAL</th>
                        <th></th>
                        <th>{{ money($transactions->where('type', 'deposit')->sum('amount')) }}</th>
                        <th>{{ money($transactions->where('type', 'withdrawal')->sum('amount')) }}</th>
                        <th></th>
                        <th></th>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    @include('reports.partials.date-filter', ['title' => 'Filter Transaction', 'action' => route('reports.cash')])
@endsection
