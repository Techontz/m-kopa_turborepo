@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">Receivable</li>
@endsection

@php
    use App\Enums\Duration;

    $isPaid = fn ($schedule): bool => (float) $schedule->paid_amount >= (float) $schedule->amount;
    // Live: the "Monthly" tab opens the "All Receivable" pane.
    $panes = [
        'Account' => ['Weekly Receivable', $schedules->filter(fn ($schedule): bool => $schedule->loan->duration === Duration::Weekly)],
        'General' => ['Daily Receivable', $schedules->filter(fn ($schedule): bool => $schedule->loan->duration === Duration::Daily)],
    ];
@endphp

@section('content')
    @include('reports.partials.tabs', ['tabs' => ['#Basic' => 'Monthly', '#Account' => 'Weekly', '#General' => 'Daily']])

    <div class="tab-content padding-0">
        <div class="tab-pane active" id="Basic">
            <div class="card">
                <div class="body">
                    <h6>All Receivable</h6>
                    <div class="pull-right">
                        <a href="javascript:;" data-toggle="modal" data-target="#addcontact2" class="btn btn-sm btn-primary"><i class="icon-magnifier"></i></a>
                    </div>
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
                                    <th>Restoration</th>
                                    <th>Receivable Amount</th>
                                    <th>Paid Amount</th>
                                    <th>Pending amount</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($schedules as $schedule)
                                    <tr>
                                        <td>{{ $loop->iteration }}.</td>
                                        <td>{{ $schedule->loan->customer->full_name }}</td>
                                        <td>{{ $schedule->loan->branch->name }}</td>
                                        <td>{{ $schedule->loan->customer->phone }}</td>
                                        <td>{{ $schedule->loan->duration->label() }}</td>
                                        <td>{{ money($schedule->loan->total_payable) }}</td>
                                        <td>{{ money($schedule->loan->restoration) }}</td>
                                        <td>{{ money($schedule->amount) }}</td>
                                        <td>{{ money($schedule->paid_amount) }}</td>
                                        <td>{{ money(max(0, (float) $schedule->amount - (float) $schedule->paid_amount)) }}</td>
                                        <td>
                                            @if ($isPaid($schedule))
                                                <span class="badge badge-success">PAID</span>
                                            @else
                                                <span class="badge badge-danger">NOT PAID</span>
                                            @endif
                                        </td>
                                        <td>{{ $schedule->due_date->format('Y-m-d') }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        @foreach ($panes as $paneId => [$heading, $paneSchedules])
            <div class="tab-pane" id="{{ $paneId }}">
                <div class="card">
                    <div class="header">
                        <h2>{{ $heading }}</h2>
                    </div>
                    <div class="body">
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
                                        <th>Receivable Amount</th>
                                        <th>Employee</th>
                                        <th>paid status</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($paneSchedules as $schedule)
                                        <tr>
                                            <td>{{ $loop->iteration }}.</td>
                                            <td>{{ $schedule->loan->customer->full_name }}</td>
                                            <td>{{ $schedule->loan->branch->name }}</td>
                                            <td>{{ $schedule->loan->customer->phone }}</td>
                                            <td>{{ $schedule->loan->duration->label() }}</td>
                                            <td>{{ money($schedule->loan->total_payable) }}</td>
                                            <td>{{ money($schedule->amount) }}</td>
                                            <td>{{ $schedule->loan->employee?->full_name }}</td>
                                            <td>
                                                @if ($isPaid($schedule))
                                                    <span class="badge badge-success">PAID</span>
                                                @else
                                                    <span class="badge badge-danger">NOT PAID</span>
                                                @endif
                                            </td>
                                            <td>{{ $schedule->due_date->format('Y-m-d') }}</td>
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
                                        <td><b>{{ money($paneSchedules->sum('amount')) }}</b></td>
                                        <td></td>
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

    @php($today = now()->format('Y-m-d'))
    <x-modal id="addcontact2" title="Filter Receivable" :action="route('reports.receivable')" method="GET" submit="Filter" size="">
        <div class="row clearfix">
            <div class="col-md-6 col-6">
                <span>Select Branch:</span>
                <x-branch-select :branches="$branches" all :selected="request('blanch_id')" />
            </div>
            <div class="col-md-6 col-6">
                <span>paid status:</span>
                <select class="form-control" name="paid_status" required>
                    <option value="">Select status</option>
                    @foreach (['paid' => 'paid', 'not paid' => 'not paid', 'all' => 'ALL'] as $value => $label)
                        <option value="{{ $value }}" @selected(request('paid_status') === $value)>{{ $label }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-md-6 col-6">
                <span>From:</span>
                <input type="date" name="from" value="{{ request('from', $today) }}" class="form-control" required>
            </div>
            <div class="col-md-6 col-6">
                <span>To:</span>
                <input type="date" name="to" value="{{ request('to', $today) }}" class="form-control" required>
            </div>
        </div>
    </x-modal>
@endsection
