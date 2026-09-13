@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">HRM</li>
    <li class="breadcrumb-item active">Staff Deduction</li>
@endsection

@section('content')
    <x-card title="Staff Deduction Form">
        <form action="{{ route('deductions.store') }}" method="POST">
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
                <div class="col-lg-2 col-6">
                    <span>Amount</span>
                    <input type="number" name="amount" placeholder="Enter Amount" autocomplete="off" class="form-control input-sm" value="{{ old('amount') }}" required>
                </div>
                <div class="col-lg-2 col-6">
                    <span>Instalment</span>
                    <input type="number" name="instalment" placeholder="instalment" autocomplete="off" class="form-control input-sm" value="{{ old('instalment') }}" required>
                </div>
                <div class="col-md-12 col-12">
                    <span>Description</span>
                    <textarea class="form-control" name="description" rows="4" placeholder="Enter Description">{{ old('description') }}</textarea>
                </div>
            </div>
            <div class="text-center mt-3">
                <button type="submit" class="btn btn-primary btn-sm">Save</button>
                <button type="reset" class="btn btn-danger btn-sm">Cancel</button>
            </div>
        </form>
    </x-card>

    <x-card title="Sataff Deduction List">
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
                        <th>Instalment</th>
                        <th>Instalment Amount</th>
                        <th>Description</th>
                        <th>status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($deductions as $deduction)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $deduction->branch->name }}</td>
                            <td>{{ $deduction->employee->full_name }}</td>
                            <td>{{ money($deduction->amount) }}</td>
                            <td>{{ $deduction->instalments }}</td>
                            <td>{{ money($deduction->instalment_amount) }}</td>
                            <td>{{ $deduction->description }}</td>
                            <td><span class="badge {{ $deduction->status === 'active' ? 'badge-success' : 'badge-info' }}">{{ $deduction->status }}</span></td>
                            <td>{{ $deduction->created_at->format('Y-m-d') }}</td>
                            <td></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-date-range-filter id="addcontact2" :action="route('deductions.index')" :branches="$branches" />
@endsection
