@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">HRM</li>
    <li class="breadcrumb-item active">Sallary Advance</li>
@endsection

@section('content')
    <x-card title="Sallary Advance">
        <x-slot:actions>
            <x-header-button target="addcontact2" icon="icon-pencil" title="Request" />
            <x-header-button target="addcontact3" icon="icon-list" title="aproved List" />
            <x-header-button target="addcontact4" title="filter" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Branch</th>
                        <th>Staff name</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($advances as $advance)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $advance->branch->name }}</td>
                            <td>{{ $advance->employee->full_name }}</td>
                            <td>{{ money($advance->amount) }}</td>
                            <td>{{ $advance->created_at->format('Y-m-d H:i:s') }}</td>
                            <td><span class="badge badge-danger">{{ $advance->status }}</span></td>
                            <td class="text-nowrap">
                                <x-action-button :action="route('staff-salary-advances.approve', $advance)" confirm="Are You Sure?" class="btn btn-sm btn-icon btn-success" icon="icon-like" title="Aprove" />
                                <x-action-button :action="route('staff-salary-advances.reject', $advance)" confirm="Are You Sure?" icon="icon-trash" title="Delete" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td>TOTAL</td>
                        <td></td>
                        <td></td>
                        <td>{{ money($advances->sum('amount')) }}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" title="Request Salary Advance" :action="route('staff-salary-advances.store')" submit="Request">
        <div class="row clearfix">
            <div class="col-lg-6 col-6">
                <span>Branch:</span>
                <x-branch-select :branches="$branches" class="form-control" data-dependent-url="{{ route('lookup.employees') }}" data-dependent-target="#advance-staff" data-dependent-param="branch_id" />
            </div>
            <div class="col-lg-6 col-6">
                <span>Staff:</span>
                <select name="empl_id" id="advance-staff" class="form-control" required>
                    <option value="">Select Staff</option>
                </select>
            </div>
            <div class="col-lg-6 col-6">
                <span>Category:</span>
                <select name="fee" class="form-control" required>
                    <option value="">Select category</option>
                    @foreach ($categories as $category)
                        <option value="{{ $category->id }}">{{ $category->name }}/ {{ (float) $category->amount_from }} - {{ (float) $category->amount_to }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-lg-6 col-6">
                <span>Amount:</span>
                <input type="number" name="advance_amount" placeholder="Amount" autocomplete="off" class="form-control" required>
            </div>
        </div>
    </x-modal>

    <x-modal id="addcontact3" title="Aproved Salary Advance">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Branch</th>
                        <th>Staff name</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>status</th>
                        <th>Fee</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($approved as $advance)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $advance->branch->name }}</td>
                            <td>{{ $advance->employee->full_name }}</td>
                            <td>{{ money($advance->amount) }}</td>
                            <td>{{ $advance->created_at->format('Y-m-d H:i:s') }}</td>
                            <td><span class="badge badge-success">{{ $advance->status }}</span></td>
                            <td>{{ money($advance->fee) }}</td>
                            <td></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-modal>

    <x-date-range-filter id="addcontact4" :action="route('staff-salary-advances.index')" :branches="$branches" />
@endsection
