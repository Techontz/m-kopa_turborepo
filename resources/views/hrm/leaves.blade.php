@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Employee Leave</li>
@endsection

@section('content')
    <x-card title="Employee Leave List">
        <x-slot:actions>
            <li><a href="javascript:;" data-toggle="modal" data-target="#addcontact1" class="btn btn-info btn-sm"><i class="icon-plus"></i></a></li>
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>Employee</th>
                        <th>Phone number</th>
                        <th>Blanch</th>
                        <th>Position</th>
                        <th>Leave Start date</th>
                        <th>Leave End date</th>
                        <th>Remaks</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($leaves as $leave)
                        <tr>
                            <td>{{ $leave->employee->full_name }}</td>
                            <td>{{ $leave->employee->phone }}</td>
                            <td>{{ $leave->employee->branch?->name }}</td>
                            <td class="c">{{ $leave->employee->position }}</td>
                            <td>{{ $leave->start_date->format('Y-m-d') }}</td>
                            <td>{{ $leave->end_date->format('Y-m-d') }}</td>
                            <td>{{ $leave->remarks }}</td>
                            <td><span class="badge {{ $leave->status === 'pending' ? 'badge-warning' : 'badge-success' }}">{{ $leave->status }}</span></td>
                            <td></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact1" title="Employee Leave" :action="route('leaves.store')" submit="Save">
        <div class="row clearfix">
            <div class="col-lg-12 col-12">
                <span>Employee:</span>
                <select name="empl_id" class="form-control select2" required>
                    <option value="">Select Employee</option>
                    @foreach ($employees as $employee)
                        <option value="{{ $employee->id }}">{{ $employee->full_name }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-lg-6 col-6">
                <span>Leave Start date:</span>
                <input type="date" name="stat_date" class="form-control" required>
            </div>
            <div class="col-lg-6 col-6">
                <span>Leave End date:</span>
                <input type="date" name="end_date" class="form-control" required>
            </div>
            <div class="col-lg-12 col-12">
                <span>Remaks:</span>
                <textarea name="remaks" class="form-control" rows="3" placeholder="Remaks" required></textarea>
            </div>
        </div>
    </x-modal>
@endsection
