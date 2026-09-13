@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">Default Loan</li>
@endsection

@php
    use App\Enums\Duration;
    use App\Services\Reports\LoanReports;

    $panes = [
        'Basic' => ['All default laoan', $loans, 'all'],
        'aditinal' => ['Monthly Default loan', $loans->filter(fn ($loan): bool => $loan->duration === Duration::Monthly), 'monthly'],
        'Account' => ['Weekly Default loan', $loans->filter(fn ($loan): bool => $loan->duration === Duration::Weekly), 'short'],
        'General' => ['Daily Default Loan', $loans->filter(fn ($loan): bool => $loan->duration === Duration::Daily), 'short'],
    ];
@endphp

@section('content')
    @include('reports.partials.tabs', ['tabs' => ['#Basic' => 'All', '#aditinal' => 'Monthly', '#Account' => 'Weekly', '#General' => 'Daily']])

    <div class="tab-content padding-0">
        @foreach ($panes as $paneId => [$heading, $paneLoans, $layout])
            <div class="tab-pane {{ $loop->first ? 'active' : '' }}" id="{{ $paneId }}">
                <div class="card">
                    <div class="body">
                        <h6>{{ $heading }}</h6>
                        @if ($layout === 'all')
                            <div class="pull-right">
                                <a href="javascript:;" data-toggle="modal" data-target="#addcontact2" class="btn btn-sm btn-primary"><i class="icon-magnifier"></i></a>
                            </div>
                        @endif
                        <div class="table-responsive">
                            <table class="table table-hover js-basic-example dataTable table-custom">
                                <thead class="thead-info">
                                    <tr>
                                        <th>S/No.</th>
                                        <th>Branch Name</th>
                                        <th>Customer Name</th>
                                        <th>Phone Number</th>
                                        <th>Loan Amount</th>
                                        <th>Restoration</th>
                                        <th>Duration Type</th>
                                        <th>Number of Repayment</th>
                                        @if ($layout !== 'short')
                                            <th>{{ $layout === 'all' ? 'Paid This Month' : 'Paid this Month' }}</th>
                                        @endif
                                        <th>Remain Amount</th>
                                        <th>Satart date</th>
                                        <th>End date</th>
                                        @if ($layout !== 'short')
                                            <th>{{ $layout === 'all' ? 'Action' : '' }}</th>
                                        @endif
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($paneLoans as $loan)
                                        <tr>
                                            <td>{{ $loop->iteration }}</td>
                                            <td>{{ $loan->branch->name }}</td>
                                            <td>{{ $loan->customer->full_name }}</td>
                                            <td>{{ $loan->customer->phone }}</td>
                                            <td>{{ money($loan->total_payable) }}</td>
                                            <td>{{ money($loan->restoration) }}</td>
                                            <td>{{ $loan->duration->label() }}</td>
                                            <td>{{ $loan->sessions }}</td>
                                            @if ($layout !== 'short')
                                                <td>{{ money($loan->paid_this_month) }}</td>
                                            @endif
                                            <td>{{ money(LoanReports::remaining($loan)) }}</td>
                                            <td>{{ $loan->withdrawn_at?->format('Y-m-d') }}</td>
                                            <td>{{ $loan->end_date?->format('Y-m-d') }}</td>
                                            @if ($layout === 'all')
                                                <td>
                                                    <x-action-button :action="route('loans.write-off', $loan)" confirm="Are you sure to wright-off" class="btn btn-sm btn-danger" icon="icon-close" />
                                                </td>
                                            @elseif ($layout === 'monthly')
                                                <td></td>
                                            @endif
                                        </tr>
                                    @endforeach
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td><b>TOTAL:</b></td>
                                        @for ($column = 0; $column < 7; $column++)
                                            <td></td>
                                        @endfor
                                        @if ($layout !== 'short')
                                            <td><b>{{ money($paneLoans->sum('paid_this_month')) }}</b></td>
                                        @endif
                                        <td><b>{{ money($paneLoans->sum(fn ($loan): float => LoanReports::remaining($loan))) }}</b></td>
                                        <td></td>
                                        <td></td>
                                        @if ($layout !== 'short')
                                            <td></td>
                                        @endif
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        @endforeach
    </div>

    @include('reports.partials.branch-filter', ['action' => route('reports.default')])
@endsection
