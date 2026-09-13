@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Clientless transaction</li>
    <li class="breadcrumb-item active">Deposit</li>
@endsection

@section('content')
    <x-card title="transaction list">
        <x-slot:actions>
            <li><a href="javascript:;" class="btn btn-success btn-sm" data-toggle="modal" data-target="#addcontact4" title="balance"><i class="icon-wallet"></i></a></li>
            <x-header-button target="addcontact3" title="Filter" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Branch</th>
                        <th>customer</th>
                        <th>Deposit Amount</th>
                        <th>Loan Amount</th>
                        <th>User</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($transactions as $transaction)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $transaction->branch?->name }}</td>
                            <td>{{ $transaction->customer?->full_name }}</td>
                            <td>{{ money($transaction->amount) }}</td>
                            <td>{{ money($transaction->loan_amount) }}</td>
                            <td>{{ $transaction->employee?->full_name }}</td>
                            <td>{{ $transaction->transaction_date->format('Y-m-d') }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL</b></td>
                        <td></td>
                        <td></td>
                        <td><b>{{ money($transactions->sum('amount')) }}</b></td>
                        <td><b>{{ money($transactions->sum('loan_amount')) }}</b></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    @include('agent.partials.balance-modal')

    <x-modal id="addcontact3" title="Filter" :action="route('agent-transactions.deposit')" method="GET" submit="filter" size="">
        <div class="row clearfix">
            <div class="col-md-12">
                <span>Branch</span>
                <x-branch-select :branches="$branches" placeholder="select" all :selected="request('blanch_id')" />
            </div>
            <div class="col-md-6">
                <span>From</span>
                <input type="date" name="from" class="form-control" value="{{ request('from') }}" required>
            </div>
            <div class="col-md-6">
                <span>To</span>
                <input type="date" name="to" class="form-control" value="{{ request('to') }}" required>
            </div>
        </div>
    </x-modal>
@endsection
