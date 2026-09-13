@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Salary Advance</li>
    <li class="breadcrumb-item active">salary Advance Loan Requested</li>
@endsection

@section('content')
    <x-card title="Request Loan">
        <form action="{{ route('salary-advances.store') }}" method="POST" data-confirm="Are you sure?">
            @csrf
            <div class="row">
                <div class="col-md-6 col-6">
                    <span>*Branch:</span>
                    <select name="blanch_id" id="blanch" class="form-control select2" data-dependent-url="{{ route('lookup.customers') }}" data-dependent-target="#customer" data-dependent-param="branch_id">
                        <option value="">Select Branch</option>
                        @foreach ($branches as $branch)
                            <option value="{{ $branch->id }}" @selected((string) old('blanch_id') === (string) $branch->id)>{{ $branch->name }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-6 col-6">
                    <span>*Customer:</span>
                    <select name="customer_id" id="customer" class="form-control select2">
                        <option value="">Select customer</option>
                    </select>
                </div>
                <div class="col-md-6 col-6">
                    <span>*Select Category:</span>
                    <select name="per_id" class="form-control" required>
                        <option value="">Select Category</option>
                        @foreach ($categories as $category)
                            <option value="{{ $category->id }}" @selected((string) old('per_id') === (string) $category->id)>{{ $category->name }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-6 col-6">
                    <span>*Loan Amount</span>
                    <input type="number" name="loan_amount" class="form-control" placeholder="Enter Amount" autocomplete="off" value="{{ old('loan_amount') }}">
                </div>
            </div>
            <br>
            <div class="text-center">
                <button type="submit" class="btn btn-primary"><i class="icon-drawer"></i>Request</button>
            </div>
        </form>
    </x-card>

    <x-card title="Salary Advance Requested">
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
                            <td>Pending</td>
                            <td>{{ $advance->created_at->format('Y-m-d H:i:s') }}</td>
                            <td class="text-nowrap">
                                <x-action-button :action="route('salary-advances.approve', $advance)" confirm="Are you sure to Aprove?" icon="icon-like" class="btn btn-success btn-sm" title="Aprove" />
                                <x-action-button :action="route('salary-advances.destroy', $advance)" method="DELETE" confirm="Are you sure?" icon="icon-trash" class="btn btn-danger btn-sm" title="Delete" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL:</b></td>
                        <td></td>
                        <td><b>{{ money($advances->sum('amount')) }}</b></td>
                        <td></td>
                        <td><b>{{ money($advances->sum('total_payable')) }}</b></td>
                        <td><b>{{ money($advances->sum('paid_amount')) }}</b></td>
                        <td><b>{{ money($advances->sum('remaining_amount')) }}</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" title="Filter debit pending" :action="route('salary-advances.requested')" method="GET" submit="Save" size="">
        <span>Select Branch:</span>
        <x-branch-select :branches="$branches" placeholder="select" all :selected="request('blanch_id')" />
    </x-modal>
@endsection
