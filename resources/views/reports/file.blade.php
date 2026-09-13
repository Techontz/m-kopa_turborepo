@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">File</li>
@endsection

@php
    use App\Services\Reports\LoanReports;
@endphp

@section('content')
    <x-card title="File">
        <x-slot:actions>
            <x-header-button target="addcontact1" />
            <li><a href="{{ route('reports.new-loans') }}" class="btn btn-sm btn-warning"><i class="icon-drawer" title="New Loan"></i></a></li>
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
                        @foreach ($months as $month)
                            <th>{{ $month }}</th>
                        @endforeach
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
                            @foreach ($months as $number => $month)
                                <td>{{ money($monthly[$loan->id][$number] ?? 0) }}</td>
                            @endforeach
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <th>TOTAL</th>
                        @for ($column = 0; $column < 10; $column++)
                            <th></th>
                        @endfor
                        @foreach ($months as $number => $month)
                            <th>{{ money(collect($monthly)->sum(fn (array $amounts): float => $amounts[$number] ?? 0)) }}</th>
                        @endforeach
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact1" title="Filter Loan Collection" :action="route('reports.file')" method="GET" submit="Filter" size="">
        <div class="row clearfix">
            <div class="col-md-6 col-6">
                <span>*Select Year:</span>
                <select class="form-control" name="year" required>
                    <option value="">Select Year</option>
                    @foreach ($years as $option)
                        <option value="{{ $option }}" @selected((int) request('year') === $option)>{{ $option }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-lg-6">
                <span>*Select Branch:</span>
                <x-branch-select :branches="$branches" :selected="request('blanch_id')" />
            </div>
            <div class="col-md-12 col-12">
                <span>*Status:</span>
                <select class="form-control" name="loan_status" required>
                    <option value="">Select Status</option>
                    @foreach (['ALL', 'ACTIVE', 'CLOSED', 'DEFAULT'] as $option)
                        <option value="{{ $option }}" @selected(request('loan_status') === $option)>{{ $option }}</option>
                    @endforeach
                </select>
            </div>
        </div>
    </x-modal>
@endsection
