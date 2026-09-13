@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Emoloyee</li>
    <li class="breadcrumb-item active">Employee Profile</li>
@endsection

@section('content')
    <div class="card">
        <div class="row profile_state">
            <div class="col-lg-6 col-6">
                <div class="body">
                    <div class="profile-image">
                        <img id="employee-photo" src="{{ $employee->photo_url }}" class="img-thumbnail" alt="customer image" style="width: 135px; height: 135px;">
                    </div>
                </div>
            </div>
            <div class="col-lg-6 col-6">
                <div class="body text-center">
                    <span>Upload Pasport</span>
                    <div class="profile-image">
                        <br><br>
                        <input type="file" accept="image/*" class="image form-control js-crop-input" name="image" data-upload-url="{{ route('employees.photo', $employee) }}" data-preview="#employee-photo">
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="body">
            <ul class="nav nav-tabs-new profile-tabs">
                <li class="nav-item"><a class="nav-link active" data-toggle="tab" href="#Basic">Basic</a></li>
                <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#aditinal">Salary</a></li>
                <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#allowance">Allowance</a></li>
                <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#Account">Salary Advance</a></li>
                <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#General">Loans</a></li>
                <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#deduction">Deduction</a></li>
                <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#Salary_slip">Salary Slip</a></li>
                <li class="nav-item"><a class="nav-link" href="{{ route('employees.index') }}">Back</a></li>
            </ul>
        </div>
    </div>

    <div class="tab-content padding-0">
        <div class="tab-pane active" id="Basic">
            <div class="card">
                <div class="body">
                    <h6>Basic Information</h6>
                    <form action="{{ route('employees.update', $employee) }}" method="POST">
                        @csrf
                        @method('PUT')
                        <div class="row">
                            <div class="col-lg-4 col-6">
                                <span>First name:</span>
                                <input type="text" name="empl_name" placeholder="Enter full name" autocomplete="off" value="{{ old('empl_name', $employee->first_name) }}" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-6">
                                <span>Midle name:</span>
                                <input type="text" name="emp_mname" placeholder="Enter full name" autocomplete="off" value="{{ old('emp_mname', $employee->middle_name) }}" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-6">
                                <span>Last name:</span>
                                <input type="text" name="emp_lname" placeholder="Enter full name" autocomplete="off" value="{{ old('emp_lname', $employee->last_name) }}" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-6">
                                <span>Phone Number:</span>
                                <input type="text" name="empl_no" placeholder="Phone Number" autocomplete="off" value="{{ old('empl_no', $employee->phone) }}" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-6">
                                <span>Date of Birth:</span>
                                <input type="date" name="date_birth" data-age-target="#profile-age" autocomplete="off" value="{{ old('date_birth', $employee->date_of_birth?->format('Y-m-d')) }}" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-6">
                                <span>Year:</span>
                                <input type="text" name="year" id="profile-age" placeholder="Year" readonly autocomplete="off" value="{{ $employee->date_of_birth ? now()->year - $employee->date_of_birth->year : '' }}" class="form-control input-sm">
                            </div>
                            <div class="col-lg-6 col-6">
                                <span>*Email:</span>
                                <input type="email" name="empl_email" placeholder="Email" autocomplete="off" value="{{ old('empl_email', $employee->email) }}" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-6 col-6">
                                <span>Branch:</span>
                                <x-branch-select :branches="$branches" :selected="$employee->branch_id" class="form-control input-sm" />
                            </div>
                            <div class="col-lg-4 col-6">
                                <span>Position:</span>
                                <select name="position_id" class="form-control" required>
                                    @foreach (\App\Models\Employee::POSITIONS as $value => $label)
                                        <option value="{{ $value }}" @selected(old('position_id', $employee->position) === $value)>{{ $label }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-lg-4 col-6">
                                <span>*Username:</span>
                                <input type="text" name="username" placeholder="Enter Username" autocomplete="off" value="{{ old('username', $employee->username) }}" class="form-control input-sm">
                            </div>
                            <div class="col-lg-4 col-12">
                                <span>*Gender:</span>
                                <select name="empl_sex" class="form-control">
                                    <option value="Male" @selected(strtolower((string) old('empl_sex', $employee->gender)) === 'male')>Male</option>
                                    <option value="Female" @selected(strtolower((string) old('empl_sex', $employee->gender)) === 'female')>Female</option>
                                </select>
                            </div>
                        </div>
                        <br>
                        <div class="text-center">
                            <button type="submit" class="btn btn-primary">Update</button>
                        </div>
                    </form>
                </div>
            </div>

            <div class="card">
                <div class="header">
                    <h2>Change Password</h2>
                </div>
                <div class="body">
                    <form action="{{ route('employees.password', $employee) }}" method="POST">
                        @csrf
                        @method('PUT')
                        <div class="row">
                            <div class="col-lg-4 col-12">
                                <span>Old Password:</span>
                                <input type="password" name="oldpass" placeholder="******" autocomplete="off" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-12">
                                <span>New Password:</span>
                                <input type="password" name="newpass" placeholder="******" autocomplete="off" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-12">
                                <span>Confirm Password:</span>
                                <input type="password" name="passconf" placeholder="******" autocomplete="off" class="form-control input-sm" required>
                            </div>
                        </div>
                        <br>
                        <div class="text-center">
                            <button type="submit" class="btn btn-primary"><i class="icon-key"></i> Change password</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="tab-pane" id="aditinal">
            <div class="card">
                <div class="header">
                    <h6 class="mb-0">Sallary &amp; Bank Account</h6>
                    @unless ($employee->salaryInfo)
                        <ul class="header-dropdown">
                            <x-header-button target="addcontact3" icon="icon-plus" />
                        </ul>
                    @endunless
                </div>
                <div class="body">
                    <div class="table-responsive">
                        <table class="table table-hover js-basic-example dataTable table-custom">
                            <thead class="thead-info">
                                <tr>
                                    <th>Account Name</th>
                                    <th>Account Number</th>
                                    <th>Amount</th>
                                    <th>Fee</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                @if ($employee->salaryInfo)
                                    <tr>
                                        <td>{{ $employee->salaryInfo->account_name }}</td>
                                        <td>{{ $employee->salaryInfo->account_number }}</td>
                                        <td>{{ money($employee->salaryInfo->salary) }}</td>
                                        <td>{{ money($employee->salaryInfo->fee) }}</td>
                                        <td><a href="javascript:;" data-toggle="modal" data-target="#addcontact3" class="btn btn-sm btn-primary" title="Edit"><i class="icon-pencil"></i></a></td>
                                    </tr>
                                @endif
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="tab-pane" id="allowance">
            <x-card title="Allowance List">
                @include('hrm.employees.partials.amount-table', ['items' => $employee->allowances])
            </x-card>
        </div>

        <div class="tab-pane" id="Account">
            <x-card title="Salary Advance List">
                <div class="table-responsive">
                    <table class="table table-hover js-basic-example dataTable table-custom">
                        <thead class="thead-info">
                            <tr>
                                <th>S/No.</th>
                                <th>Amount</th>
                                <th>status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($employee->salaryAdvances as $advance)
                                <tr>
                                    <td>{{ $loop->iteration }}.</td>
                                    <td>{{ money($advance->amount) }}</td>
                                    <td>
                                        <span class="badge {{ match ($advance->status) { 'pending' => 'badge-danger', 'rejected' => 'badge-warning', default => 'badge-success' } }}">{{ $advance->status }}</span>
                                    </td>
                                    <td>{{ $advance->created_at->format('Y-m-d H:i:s') }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </x-card>
        </div>

        <div class="tab-pane" id="General">
            <x-card title="All Loans">
                <div class="table-responsive">
                    <table class="table table-hover js-basic-example dataTable table-custom">
                        <thead class="thead-info">
                            <tr>
                                <th>S/No.</th>
                                <th>How loan</th>
                                <th>Loan Aproved</th>
                                <th>No.Repayment</th>
                                <th>Loan + interest</th>
                                <th>Restration</th>
                                <th>Paid Amount</th>
                                <th>Remain Amount</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($employee->staffLoans as $loan)
                                <tr>
                                    <td>{{ $loop->iteration }}.</td>
                                    <td>{{ money($loan->amount_applied) }}</td>
                                    <td>{{ money($loan->amount_approved) }}</td>
                                    <td>{{ ucfirst($loan->duration) }} / {{ $loan->sessions }}</td>
                                    <td>{{ money($loan->total_payable) }}</td>
                                    <td>{{ money($loan->restoration) }}</td>
                                    <td>{{ money($loan->paidAmount()) }}</td>
                                    <td>{{ money($loan->remainingAmount()) }}</td>
                                    <td><span class="badge badge-success">{{ $loan->status === 'active' ? 'Aproved' : $loan->status }}</span></td>
                                    <td>{{ $loan->created_at->format('Y-m-d H:i:s') }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </x-card>
        </div>

        <div class="tab-pane" id="deduction">
            <x-card title="Deduction">
                @include('hrm.employees.partials.amount-table', ['items' => $employee->deductions])
            </x-card>
        </div>

        <div class="tab-pane" id="Salary_slip">
            <x-card title="Salary slip">
                <div class="table-responsive">
                    <table class="table table-hover js-basic-example dataTable table-custom">
                        <thead class="thead-info">
                            <tr>
                                <th>S/No.</th>
                                <th>Sallary Amount</th>
                                <th>Sallary Advance</th>
                                <th>Allowance</th>
                                <th>Deduction</th>
                                <th>Loan Restration</th>
                                <th>Take Home</th>
                                <th>Phone no</th>
                                <th>Account name</th>
                                <th>Account no</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($employee->salaryPayments as $payment)
                                <tr>
                                    <td>{{ $loop->iteration }}.</td>
                                    <td>{{ money($payment->salary) }}</td>
                                    <td>{{ money($payment->salary_advance) }}</td>
                                    <td>{{ money($payment->allowance) }}</td>
                                    <td>{{ money($payment->deduction) }}</td>
                                    <td>{{ money($payment->loan_restoration) }}</td>
                                    <td>{{ money($payment->take_home) }}</td>
                                    <td>{{ $payment->phone }}</td>
                                    <td>{{ $payment->account_name }}</td>
                                    <td>{{ $payment->account_number }}</td>
                                    <td>{{ $payment->created_at->format('Y-m-d H:i:s') }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </x-card>
        </div>
    </div>

    <x-modal id="addcontact3" title="Add Sallary Information" :action="route('employees.salary', $employee)" :submit="$employee->salaryInfo ? 'update' : 'Save'">
        <div class="row clearfix">
            <div class="col-lg-6 col-6">
                <span>Sallary Amount:</span>
                <input type="text" name="salary" placeholder="Enter Amount" autocomplete="off" value="{{ $employee->salaryInfo ? (float) $employee->salaryInfo->salary : '' }}" class="form-control input-sm" required>
            </div>
            <div class="col-lg-6 col-6">
                <span>Account Name:</span>
                <input type="text" name="account_name" placeholder="Enter Account Name" autocomplete="off" value="{{ $employee->salaryInfo?->account_name }}" class="form-control input-sm" required>
            </div>
            <div class="col-lg-6 col-6">
                <span>*Account Number:</span>
                <input type="text" name="account_number" placeholder="Enter Account Number" autocomplete="off" value="{{ $employee->salaryInfo?->account_number }}" class="form-control input-sm" required>
            </div>
            <div class="col-lg-6 col-6">
                <span>*Fee:</span>
                <input type="text" name="fee_salary" placeholder="Enter Fee" autocomplete="off" value="{{ $employee->salaryInfo ? (float) $employee->salaryInfo->fee : '' }}" class="form-control input-sm" required>
            </div>
        </div>
    </x-modal>

    @push('modals')
        <div class="modal fade" id="crop-modal" tabindex="-1" role="dialog" aria-hidden="true">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-body">
                        <div class="img-container">
                            <div class="row">
                                <div class="col-md-6 col-6"><img id="crop-image" alt="" style="max-width: 100%;"></div>
                                <div class="col-md-6 col-6"><div class="preview" style="width: 160px; height: 160px; overflow: hidden;"></div></div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="crop-button">Crop</button>
                    </div>
                </div>
            </div>
        </div>
    @endpush
@endsection
