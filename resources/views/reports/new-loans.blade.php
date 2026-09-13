@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">File</li>
@endsection

@php
    use App\Services\Reports\LoanReports;
@endphp

@section('content')
    <x-card :title="'FILE REPORT NEW LOAN / Year ('.$year.')'">
        <x-slot:actions>
            <x-header-button target="addcontact1" />
            <li><a href="{{ route('reports.new-loans') }}" class="btn btn-sm btn-warning"><i class="icon-drawer" title="New Loan"></i></a></li>
            <li><a href="javascript:window.print();" class="btn btn-sm btn-primary"><i class="icon-printer"></i></a></li>
        </x-slot:actions>

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
                        <th>Collection</th>
                        <th>Paid Amount</th>
                        <th>Remain Amount</th>
                        <th>Withdrawal Date</th>
                        <th>Loan Status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($loans as $loan)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $loan->branch->name }}</td>
                            <td>{{ $loan->customer->full_name }}</td>
                            <td>{{ $loan->customer->phone }}</td>
                            <td>{{ money($loan->total_payable) }}</td>
                            <td>{{ $loan->duration->label() }}</td>
                            <td>{{ money($loan->restoration) }}</td>
                            <td>{{ money($loan->paid_sum) }}</td>
                            <td>{{ money(LoanReports::remaining($loan)) }}</td>
                            <td>{{ $loan->withdrawn_at?->format('Y-m-d') }}</td>
                            <td><span class="badge badge-{{ $loan->status->badge() }}">{{ $loan->status->label() }}</span></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    @include('reports.partials.branch-filter', ['id' => 'addcontact1', 'action' => route('reports.new-loans'), 'placeholder' => '---Select Branch---', 'all' => false])
@endsection
