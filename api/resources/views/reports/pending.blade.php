@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">Loan Pending</li>
@endsection

@php
    use App\Enums\Duration;

    // Live: the "Monthly" tab opens the "All loan pending" pane.
    $panes = [
        'Basic' => ['All loan pending', $rows, true],
        'Account' => ['Weekly loan pending', $rows->filter(fn (array $row): bool => $row['loan']->duration === Duration::Weekly), false],
        'General' => ['Daily loan pending', $rows->filter(fn (array $row): bool => $row['loan']->duration === Duration::Daily), false],
    ];
@endphp

@section('content')
    @include('reports.partials.tabs', ['tabs' => ['#Basic' => 'Monthly', '#Account' => 'Weekly', '#General' => 'Daily']])

    <div class="tab-content padding-0">
        @foreach ($panes as $paneId => [$heading, $paneRows, $hasFilter])
            <div class="tab-pane {{ $loop->first ? 'active' : '' }}" id="{{ $paneId }}">
                <div class="card">
                    <div class="body">
                        <h6>{{ $heading }}</h6>
                        @if ($hasFilter)
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
                                        <th>Duration Type</th>
                                        <th>Pending Amount</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($paneRows as $row)
                                        <tr>
                                            <td>{{ $loop->iteration }}.</td>
                                            <td>{{ $row['loan']->branch->name }}</td>
                                            <td>{{ $row['loan']->customer->full_name }}</td>
                                            <td>{{ $row['loan']->customer->phone }}</td>
                                            <td>{{ money($row['loan']->total_payable) }}</td>
                                            <td>{{ $row['loan']->duration->label() }}</td>
                                            <td>{{ money($row['pending']) }}</td>
                                            <td>{{ $row['date']->format('Y-m-d') }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                                @unless ($hasFilter)
                                    <tfoot>
                                        <tr>
                                            <td><b>TOTAL:</b></td>
                                            <td></td>
                                            <td></td>
                                            <td></td>
                                            <td></td>
                                            <td></td>
                                            <td><b>{{ money($paneRows->sum('pending')) }}</b></td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                @endunless
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        @endforeach
    </div>

    @include('reports.partials.branch-filter', ['title' => 'Filter Loan Pending', 'action' => route('reports.pending')])
@endsection
