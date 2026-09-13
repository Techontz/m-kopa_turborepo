@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">Loan Collection</li>
@endsection

@php
    use App\Services\Reports\LoanReports;

    $penalty = fn ($loan): float => max(0, (float) $loan->penalty_total - (float) $loan->penalty_paid);
@endphp

@section('content')
    <x-card title="Loan Collection">
        <x-slot:actions>
            <x-header-button target="addcontact1" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Branch Name</th>
                        <th>Customer Name</th>
                        <th>Employee</th>
                        <th>Loan Amount</th>
                        <th>Collection</th>
                        <th>Paid Amount</th>
                        <th>Remain Amount</th>
                        <th>Penart Amount</th>
                        <th>End Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($loans as $loan)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $loan->branch->name }}</td>
                            <td>{{ $loan->customer->full_name }}</td>
                            <td>{{ $loan->employee?->full_name }}</td>
                            <td>{{ money($loan->total_payable) }}</td>
                            <td>{{ money($loan->restoration) }}</td>
                            <td>{{ money($loan->paid_sum) }}</td>
                            <td>{{ money(LoanReports::remaining($loan)) }}</td>
                            <td>{{ money($penalty($loan)) }}</td>
                            <td>{{ $loan->end_date?->format('Y-m-d') }}</td>
                            <td><a href="javascript:;" class="badge badge-{{ $loan->status->badge() }}">{{ $loan->status->label() }}</a></td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <th>TOTAL</th>
                        <th></th>
                        <th></th>
                        <th></th>
                        <th>{{ money($loans->sum('total_payable')) }}</th>
                        <th></th>
                        <th>{{ money($loans->sum('paid_sum')) }}</th>
                        <th>{{ money($loans->sum(fn ($loan): float => LoanReports::remaining($loan))) }}</th>
                        <th>{{ money($loans->sum($penalty)) }}</th>
                        <th></th>
                        <th></th>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact1" title="Filter Loan Collection" :action="route('reports.collection')" method="GET" submit="Filter" size="">
        <div class="row clearfix">
            <div class="col-md-6 col-6">
                <span>Select Branch:</span>
                <x-branch-select :branches="$branches" placeholder="---Select Branch---" all :selected="request('blanch_id')" />
            </div>
            <div class="col-md-6 col-6">
                <span>Loan Status</span>
                <select class="form-control" name="loan_status" required>
                    <option value="">Select Loan Status</option>
                    @foreach (['PENDING', 'APROVED', 'DISBURSED', 'ACTIVE', 'DONE', 'DEFALT'] as $option)
                        <option value="{{ $option }}" @selected(request('loan_status') === $option)>{{ $option }}</option>
                    @endforeach
                </select>
            </div>
        </div>
    </x-modal>
@endsection
