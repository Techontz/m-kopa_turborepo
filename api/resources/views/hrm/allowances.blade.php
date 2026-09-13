@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">HRM</li>
    <li class="breadcrumb-item active">Staff Allowance</li>
@endsection

@section('content')
    <x-card title="Staff Allowance Form">
        <form action="{{ route('allowances.store') }}" method="POST">
            @csrf
            <div class="form-group form-group-last row">
                <div class="col-lg-4 col-4">
                    <span>Brach:</span>
                    <x-branch-select :branches="$branches" placeholder="Select branch" class="form-control select2" id="blanch" data-dependent-url="{{ route('lookup.employees') }}" data-dependent-target="#empl" data-dependent-param="branch_id" />
                </div>
                <div class="col-lg-4 col-4">
                    <span>Staff:</span>
                    <select class="form-control select2" id="empl" name="empl_id" required>
                        <option value="">Select staff</option>
                    </select>
                </div>
                <div class="col-lg-4 col-4">
                    <span>Amount</span>
                    <input type="number" name="new_amount" placeholder="Enter Amount" autocomplete="off" class="form-control input-sm" value="{{ old('new_amount') }}" required>
                </div>
                <div class="col-md-12 col-12">
                    <span>Description</span>
                    <textarea class="form-control" name="remaks_allow" rows="4" placeholder="Enter Description">{{ old('remaks_allow') }}</textarea>
                </div>
            </div>
            <div class="text-center mt-3">
                <button type="submit" class="btn btn-primary btn-sm">Save</button>
                <button type="reset" class="btn btn-danger btn-sm">Cancel</button>
            </div>
        </form>
    </x-card>

    <x-card title="Sataff Allowance List">
        <x-slot:actions>
            <x-header-button target="addcontact2" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Branch</th>
                        <th>Staff name</th>
                        <th>Amount</th>
                        <th>Description</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($allowances as $allowance)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $allowance->branch->name }}</td>
                            <td>{{ $allowance->employee->full_name }}</td>
                            <td>{{ money($allowance->amount) }}</td>
                            <td>{{ $allowance->description }}</td>
                            <td>{{ $allowance->created_at->format('Y-m-d') }}</td>
                            <td></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-date-range-filter id="addcontact2" :action="route('allowances.index')" :branches="$branches" />
@endsection
