@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">Received</li>
@endsection

@php
    use App\Enums\Duration;

    $byDuration = fn (Duration $duration) => $transactions->filter(fn ($transaction): bool => $transaction->loan?->duration === $duration);
    // Pane headings as on live, including "Daily Receivable" on the daily received pane.
    $panes = [
        'Basic' => ['All Received', $transactions, 'Reserve'],
        'aditinal' => ['Monthly Received', $byDuration(Duration::Monthly), 'reserve'],
        'Account' => ['Weekly Received', $byDuration(Duration::Weekly), 'reserve'],
        'General' => ['Daily Receivable', $byDuration(Duration::Daily), 'reserve'],
    ];
@endphp

@section('content')
    @include('reports.partials.tabs', ['tabs' => ['#Basic' => 'All', '#aditinal' => 'Monthly', '#Account' => 'Weekly', '#General' => 'Daily']])

    <div class="tab-content padding-0">
        @foreach ($panes as $paneId => [$heading, $paneTransactions, $reserveLabel])
            <div class="tab-pane {{ $loop->first ? 'active' : '' }}" id="{{ $paneId }}">
                <div class="card">
                    <div class="body">
                        <h6>{{ $heading }}</h6>
                        @if ($loop->first)
                            <div class="pull-right">
                                <a href="javascript:;" data-toggle="modal" data-target="#addcontact2" class="btn btn-sm btn-primary"><i class="icon-magnifier"></i></a>
                            </div>
                        @endif
                        <div class="table-responsive">
                            <table class="table table-hover js-basic-example dataTable table-custom">
                                <thead class="thead-info">
                                    <tr>
                                        <th>S/no</th>
                                        <th>Customer</th>
                                        <th>Branch</th>
                                        <th>Number</th>
                                        <th>Duration</th>
                                        <th>Loan</th>
                                        <th>Received Amount</th>
                                        <th>Principal</th>
                                        <th>Intrest</th>
                                        <th>{{ $reserveLabel }}</th>
                                        <th>Employee</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($paneTransactions as $transaction)
                                        <tr>
                                            <td>{{ $loop->iteration }}.</td>
                                            <td>{{ $transaction->customer?->full_name }}</td>
                                            <td>{{ $transaction->branch?->name }}</td>
                                            <td>{{ $transaction->customer?->phone }}</td>
                                            <td>{{ $transaction->loan?->duration->label() }}</td>
                                            <td>{{ money($transaction->loan?->total_payable) }}</td>
                                            <td>{{ money($transaction->amount) }}</td>
                                            <td>{{ money($transaction->principal) }}</td>
                                            <td>{{ money($transaction->interest) }}</td>
                                            <td>{{ money($transaction->reserve) }}</td>
                                            <td>{{ $transaction->employee?->full_name }}</td>
                                            <td>{{ $transaction->transaction_date->format('Y-m-d') }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td><b>TOTAL:</b></td>
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                        <td><b>{{ money($paneTransactions->sum('amount')) }}</b></td>
                                        <td><b>{{ money($paneTransactions->sum('principal')) }}</b></td>
                                        <td><b>{{ money($paneTransactions->sum('interest')) }}</b></td>
                                        <td><b>{{ money($paneTransactions->sum('reserve')) }}</b></td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        @endforeach
    </div>

    @include('reports.partials.date-filter', ['title' => 'Filter Received', 'action' => route('reports.received'), 'datesFirst' => true])
@endsection
