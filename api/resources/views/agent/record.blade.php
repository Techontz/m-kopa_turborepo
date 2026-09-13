@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Clientless transaction</li>
    <li class="breadcrumb-item active">Record transaction</li>
@endsection

@section('content')
    <x-card title="transaction list">
        <x-slot:actions>
            <li><a href="javascript:;" class="btn btn-info btn-sm" data-toggle="modal" data-target="#addcontact2" title="receord"><i class="icon-plus"></i></a></li>
            <li><a href="javascript:;" class="btn btn-success btn-sm" data-toggle="modal" data-target="#addcontact4" title="balance"><i class="icon-wallet"></i></a></li>
            <x-header-button target="addcontact3" title="Filter" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Branch</th>
                        <th>Mode of payment</th>
                        <th>Agent</th>
                        <th>Amount</th>
                        <th>Rec Time</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($transactions as $transaction)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $transaction->branch?->name }}</td>
                            <td>{{ $transaction->paymentMode?->name }}</td>
                            <td>{{ $transaction->agent }}</td>
                            <td>{{ money($transaction->amount) }}</td>
                            <td>{{ $transaction->transaction_time }}</td>
                            <td>{{ $transaction->transaction_date->format('Y-m-d') }}</td>
                            <td></td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td><b>{{ money($transactions->sum('amount')) }}</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    @include('agent.partials.balance-modal')

    <x-modal id="addcontact3" title="Filter" :action="route('agent-transactions.record')" method="GET" submit="filter" size="">
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

    <x-modal id="addcontact2" title="Record Transaction" :action="route('agent-transactions.store')" submit="save" size="">
        <div class="row clearfix">
            <div class="col-md-6">
                <span>Branch</span>
                <x-branch-select :branches="$branches" placeholder="select" />
            </div>
            <div class="col-md-6">
                <span>Mode of payment</span>
                <select name="mode_id" class="form-control" required>
                    <option value="">select</option>
                    @foreach ($modes as $mode)
                        <option value="{{ $mode->id }}" @selected((string) old('mode_id') === (string) $mode->id)>{{ $mode->name }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-md-6">
                <span>Agent Name</span>
                <input type="text" name="agent" class="form-control" placeholder="Enter agent" value="{{ old('agent') }}" autocomplete="off" required>
            </div>
            <div class="col-md-6">
                <span>Amount</span>
                <input type="number" name="amount" class="form-control" placeholder="Enter Amount" value="{{ old('amount') }}" autocomplete="off" required>
            </div>
            <div class="col-md-6">
                <span>Date</span>
                <input type="date" name="date" class="form-control" value="{{ old('date', now()->toDateString()) }}" required>
            </div>
            <div class="col-md-6">
                <span>Time</span>
                <input type="time" name="time" class="form-control" value="{{ old('time') }}" required>
            </div>
        </div>
    </x-modal>
@endsection
