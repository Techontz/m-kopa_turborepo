@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Salary Advance</li>
    <li class="breadcrumb-item active">Salary Advance Loan Repayment</li>
@endsection

@section('content')
    <x-card title="Salary Advance Loan">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>Customer Name</th>
                        <th>Branch Name</th>
                        <th>Loan Amount</th>
                        <th>Interest</th>
                        <th>Principal + Interest</th>
                        <th>Paid Amount</th>
                        <th>Remain Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($advances as $advance)
                        <tr>
                            <td>{{ $advance->customer?->full_name }}</td>
                            <td>{{ $advance->branch?->name }}</td>
                            <td>{{ money($advance->amount) }}</td>
                            <td>{{ (float) $advance->interest_rate }}%</td>
                            <td>{{ money($advance->total_payable) }}</td>
                            <td>{{ money($advance->paid_amount) }}</td>
                            <td>{{ money($advance->remaining_amount) }}</td>
                            <td>{{ strtoupper($advance->status) }}</td>
                            <td>{{ $advance->created_at->format('Y-m-d H:i:s') }}</td>
                            <td>
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-info" data-toggle="modal" data-target="#addcontact2{{ $advance->id }}" title="Deposit History"><i class="icon-list"></i></a>
                            </td>
                        </tr>

                        @include('salary-advance.partials.history-modal', ['advance' => $advance])
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
