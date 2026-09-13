@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">All Employee</li>
@endsection

@section('content')
    <x-card title="Employee List">
        <x-slot:actions>
            <x-header-button target="addcontact2" icon="icon-plus" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Photo</th>
                        <th>Empl/ID</th>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Phone number</th>
                        <th>Branch</th>
                        <th>Position</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($employees as $employee)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>
                                <div class="profile-image"><img src="{{ $employee->photo_url }}" class="img-thumbnail" alt="customer image" style="width: 70px; height: 70px;"></div>
                            </td>
                            <td>{{ $employee->employee_number }}</td>
                            <td class="c text-nowrap">{{ $employee->full_name }}</td>
                            <td>{{ $employee->username }}</td>
                            <td>{{ $employee->phone }}</td>
                            <td class="c">{{ $employee->branch?->name }}</td>
                            <td class="c">{{ $employee->position }}</td>
                            <td>
                                @if ($employee->status === 'active')
                                    <span class="badge badge-success">Active</span>
                                @else
                                    <span class="badge badge-danger">{{ $employee->status }}</span>
                                @endif
                            </td>
                            <td class="c text-nowrap">{{ $employee->created_at?->format('Y-m-d') }}</td>
                            <td class="text-nowrap">
                                <a href="{{ route('employees.show', $employee) }}" class="btn btn-primary btn-sm" title="View"><i class="icon-eye"></i></a>
                                @if ($employee->status === 'blocked')
                                    <x-action-button :action="route('employees.block', $employee)" class="btn btn-success btn-sm" icon="icon-key" title="Un Block" />
                                @else
                                    <x-action-button :action="route('employees.block', $employee)" class="btn btn-danger btn-sm" icon="icon-lock" title="Block" />
                                @endif
                                <a class="btn btn-info btn-sm" title="Privillage" href="{{ route('employees.privileges', $employee) }}"><i class="icon-arrow-right"></i></a>
                                <x-action-button :action="route('employees.destroy', $employee)" method="DELETE" confirm="Are you sure?" class="btn btn-danger btn-sm" icon="icon-trash" title="Delete" />
                                <x-action-button :action="route('employees.reject', $employee)" confirm="Are you sure to reject?" class="btn btn-danger btn-sm" icon="icon-close" title="Reject" />
                                <x-action-button :action="route('employees.reset', $employee)" confirm="Are you sure?" class="btn btn-warning btn-sm" icon="icon-key" title="Reset password" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" title="Register Employee" :action="route('employees.store')" submit="Register">
        <div class="row clearfix">
            <div class="col-lg-4 col-6">
                <span>First name:</span>
                <input type="text" name="empl_name" placeholder="Enter first name" autocomplete="off" class="form-control input-sm" value="{{ old('empl_name') }}" required>
            </div>
            <div class="col-lg-4 col-6">
                <span>Midle name:</span>
                <input type="text" name="emp_mname" placeholder="Enter midle name" autocomplete="off" class="form-control input-sm" value="{{ old('emp_mname') }}" required>
            </div>
            <div class="col-lg-4 col-6">
                <span>Last name:</span>
                <input type="text" name="emp_lname" placeholder="Enter Last name" autocomplete="off" class="form-control input-sm" value="{{ old('emp_lname') }}" required>
            </div>
            <div class="col-lg-3 col-6">
                <span>Phone Number:</span>
                <input type="text" name="empl_no" placeholder="Phone Number" autocomplete="off" class="form-control input-sm" value="{{ old('empl_no') }}" required>
            </div>
            <div class="col-lg-3 col-6">
                <span>Date of Birth:</span>
                <input type="date" name="date_birth" data-age-target="#register-age" autocomplete="off" class="form-control input-sm" value="{{ old('date_birth') }}" required>
            </div>
            <div class="col-lg-3 col-6">
                <span>Year:</span>
                <input type="text" name="year" id="register-age" placeholder="Year" readonly autocomplete="off" class="form-control input-sm" required>
            </div>
            <div class="col-lg-3 col-6">
                <span>*Email:</span>
                <input type="email" name="empl_email" placeholder="Email" autocomplete="off" class="form-control input-sm" value="{{ old('empl_email') }}" required>
            </div>
            <div class="col-lg-6 col-6">
                <span>Branch:</span>
                <x-branch-select :branches="$branches" class="form-control input-sm" />
            </div>
            <div class="col-lg-6 col-6">
                <span>Position:</span>
                <select name="position_id" class="form-control" required>
                    <option value="">Select Position</option>
                    @foreach (\App\Models\Employee::POSITIONS as $value => $label)
                        <option value="{{ $value }}" @selected(old('position_id') === $value)>{{ $label }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-lg-6 col-6">
                <span>*Username:</span>
                <input type="text" name="username" placeholder="Enter Username" autocomplete="off" class="form-control input-sm" value="{{ old('username') }}">
            </div>
            <div class="col-lg-6 col-12">
                <span>*Gender:</span>
                <select name="empl_sex" class="form-control">
                    <option value="">Select Gender</option>
                    <option value="Male" @selected(old('empl_sex') === 'Male')>Male</option>
                    <option value="Female" @selected(old('empl_sex') === 'Female')>Female</option>
                </select>
            </div>
        </div>
    </x-modal>
@endsection
