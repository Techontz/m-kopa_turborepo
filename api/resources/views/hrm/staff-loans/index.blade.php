@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">HRM</li>
    <li class="breadcrumb-item active">Staff Loan</li>
@endsection

@section('content')
    <x-card title="Staff Loan">
        <x-slot:actions>
            <x-header-button target="addcontact2" title="filter loan" />
            <x-header-button target="addcontact3" icon="icon-list" title="Aproved List" />
            <li><a href="{{ route('staff-loans.active') }}" class="btn btn-warning btn-sm" title="Active loan"><i class="icon-arrow-right"></i></a></li>
            <x-header-button target="addcontact4" icon="icon-plus" title="Apply loan" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Branch</th>
                        <th>Staff name</th>
                        <th>How loan</th>
                        <th>Loan Aproved</th>
                        <th>No.Repayment</th>
                        <th>Loan + interest</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($loans as $loan)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $loan->branch->name }}</td>
                            <td>{{ $loan->employee->full_name }}</td>
                            <td>{{ money($loan->amount_applied) }}</td>
                            <td>{{ money($loan->amount_approved) }}</td>
                            <td>{{ ucfirst($loan->duration) }} / {{ $loan->sessions }}</td>
                            <td>{{ money($loan->total_payable) }}</td>
                            <td><span class="badge badge-warning">{{ $loan->status }}</span></td>
                            <td>{{ $loan->created_at->format('Y-m-d H:i:s') }}</td>
                            <td>
                                <x-action-button :action="route('staff-loans.approve', $loan)" confirm="Are You Sure?" class="btn btn-sm btn-icon btn-success" icon="icon-like" title="Aprove" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td>TOTAL</td>
                        <td></td>
                        <td></td>
                        <td>{{ money($loans->sum('amount_applied')) }}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact4" title="Apply Staff Loan" :action="route('staff-loans.store')" submit="Submit">
        <div class="row clearfix">
            <div class="col-lg-6 col-6">
                <span>Branch:</span>
                <x-branch-select :branches="$branches" class="form-control" data-dependent-url="{{ route('lookup.employees') }}" data-dependent-target="#loan-staff" data-dependent-param="branch_id" />
            </div>
            <div class="col-lg-6 col-6">
                <span>Staff:</span>
                <select name="empl_id" id="loan-staff" class="form-control" required>
                    <option value="">Select Staff</option>
                </select>
            </div>
            <div class="col-lg-6 col-6">
                <span>Loan Category:</span>
                <select name="category_id" class="form-control" required data-dependent-url="{{ route('lookup.staff-loan-durations') }}" data-dependent-target="#loan-duration" data-dependent-param="category_id">
                    <option value="">Select Category</option>
                    @foreach ($categories as $category)
                        <option value="{{ $category->id }}">{{ $category->name }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-lg-6 col-6">
                <span>Loan Amount:</span>
                <input type="number" name="loan_amount" placeholder="Enter Loan Amount" autocomplete="off" class="form-control" required>
            </div>
            <div class="col-lg-6 col-6">
                <span>Loan Duration:</span>
                <select name="day" id="loan-duration" class="form-control" required>
                    <option value="">Select Loan Duration</option>
                </select>
            </div>
            <div class="col-lg-6 col-6">
                <span>Number of Repayments:</span>
                <input type="number" name="session" placeholder="Enter Number of Repayments" autocomplete="off" class="form-control" required>
            </div>
            <div class="col-lg-12 col-12">
                <span>Reason:</span>
                <textarea name="reason" class="form-control" rows="3" placeholder="Enter Reason" required></textarea>
            </div>
        </div>
    </x-modal>

    <x-modal id="addcontact3" title="Aproved Staff Loan">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Branch</th>
                        <th>Staff name</th>
                        <th>How loan</th>
                        <th>Loan Aproved</th>
                        <th>No.Repayment</th>
                        <th>Loan + interest</th>
                        <th>Status</th>
                        <th>charger</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($approved as $loan)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $loan->branch->name }}</td>
                            <td>{{ $loan->employee->full_name }}</td>
                            <td>{{ money($loan->amount_applied) }}</td>
                            <td>{{ money($loan->amount_approved) }}</td>
                            <td>{{ ucfirst($loan->duration) }} / {{ $loan->sessions }}</td>
                            <td>{{ money($loan->total_payable) }}</td>
                            <td><span class="badge badge-success">{{ $loan->status }}</span></td>
                            <td>{{ money($loan->fee) }}</td>
                            <td>{{ $loan->created_at->format('Y-m-d H:i:s') }}</td>
                            <td></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-modal>

    <x-date-range-filter id="addcontact2" :action="route('staff-loans.index')" :branches="$branches" />
@endsection
