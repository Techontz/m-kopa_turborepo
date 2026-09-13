@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Salary Advance</li>
    <li class="breadcrumb-item active">salary Advance Loan Aproved</li>
@endsection

@section('content')
    <x-card :title="'Salary Advance Aproved Today / '.now()->format('d,M,Y')">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>Customer Name</th>
                        <th>Phone Number</th>
                        <th>Branch Name</th>
                        <th>Loan Amount</th>
                        <th>Interest</th>
                        <th>Principal + Interest</th>
                        <th>Paid Amount</th>
                        <th>Remain Amount</th>
                        <th>Status</th>
                        <th>chargers</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($advances as $advance)
                        <tr>
                            <td>{{ $advance->customer?->full_name }}</td>
                            <td>{{ $advance->customer?->phone }}</td>
                            <td>{{ $advance->branch?->name }}</td>
                            <td>{{ money($advance->amount) }}</td>
                            <td>{{ (float) $advance->interest_rate }}%</td>
                            <td>{{ money($advance->total_payable) }}</td>
                            <td>{{ money($advance->paid_amount) }}</td>
                            <td>{{ money($advance->remaining_amount) }}</td>
                            <td>{{ strtoupper($advance->status) }}</td>
                            <td>{{ money($advance->fee) }}</td>
                            <td>{{ $advance->approved_at?->format('Y-m-d H:i:s') }}</td>
                            <td></td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL:</b></td>
                        <td></td>
                        <td></td>
                        <td><b>{{ money($advances->sum('amount')) }}</b></td>
                        <td></td>
                        <td><b>{{ money($advances->sum('total_payable')) }}</b></td>
                        <td><b>{{ money($advances->sum('paid_amount')) }}</b></td>
                        <td><b>{{ money($advances->sum('remaining_amount')) }}</b></td>
                        <td></td>
                        <td><b>{{ money($advances->sum('fee')) }}</b></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" title="Filter debit pending" :action="route('salary-advances.approved')" method="GET" submit="Save" size="">
        <span>Select Branch:</span>
        <x-branch-select :branches="$branches" placeholder="select" all :selected="request('blanch_id')" />
    </x-modal>
@endsection
