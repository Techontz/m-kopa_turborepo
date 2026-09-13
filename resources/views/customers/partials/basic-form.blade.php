{{-- Basic information fields. Expects: $customer (nullable), $branches, $regions --}}
@php
    $value = fn (string $field, string $attribute) => old($field, $customer?->{$attribute});
    $employees = $customer ? \App\Models\Employee::where('branch_id', old('blanch_id', $customer->branch_id))->where('status', 'active')->get() : collect();
    $customerTypes = $customer
        ? \App\Models\CustomerType::whereHas('mainCategory', fn ($query) => $query->where('company_id', $customer->company_id)->where('code', old('work_status', $customer->work_status)))->where('is_enabled', true)->get()
        : collect();
@endphp
<div class="row">
    <div class="col-lg-4 col-6">
        <span>First Name:</span>
        <input type="text" name="f_name" value="{{ $value('f_name', 'first_name') }}" placeholder="First name" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-4 col-6">
        <span>Middle name:</span>
        <input type="text" name="m_name" value="{{ $value('m_name', 'middle_name') }}" placeholder="Middle name" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-4 col-6">
        <span>Last name:</span>
        <input type="text" name="l_name" value="{{ $value('l_name', 'last_name') }}" placeholder="Last name" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-4 col-6">
        <span>Branch:</span>
        <select name="blanch_id" id="blanch" class="form-control select2 input-sm" required
                data-dependent-url="{{ route('lookup.employees') }}" data-dependent-target="#empl" data-dependent-param="branch_id">
            <option value="">Select Branch</option>
            @foreach ($branches as $branch)
                <option value="{{ $branch->id }}" @selected((string) $value('blanch_id', 'branch_id') === (string) $branch->id)>{{ $branch->name }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-lg-4 col-6">
        <span>Employee:</span>
        <select name="empl_id" id="empl" class="form-control select2 input-sm" required>
            <option value="">Select Employee</option>
            @foreach ($employees as $employee)
                <option value="{{ $employee->id }}" @selected((string) $value('empl_id', 'employee_id') === (string) $employee->id)>{{ $employee->full_name }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-lg-4 col-6">
        <span>Gender:</span>
        <select name="gender" class="form-control select2 input-sm" required>
            <option value="">Select Gender</option>
            <option value="male" @selected($value('gender', 'gender') === 'male')>Male</option>
            <option value="female" @selected($value('gender', 'gender') === 'female')>Female</option>
        </select>
    </div>
    <div class="col-lg-3 col-6">
        <span>Date of Birth:</span>
        <input type="date" name="date_birth" value="{{ old('date_birth', $customer?->date_of_birth?->toDateString() ?? now()->toDateString()) }}" data-age-target="#age" placeholder="Date of Birth" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-2 col-6">
        <span>Year:</span>
        <input type="text" id="age" name="age" value="{{ old('age', $customer?->age) }}" readonly class="form-control input-sm" required>
    </div>
    <div class="col-lg-3 col-6">
        <span>Phone Number:</span>
        <input type="number" name="phone_no" value="{{ $value('phone_no', 'phone') }}" placeholder="Eg.0753(XXXX)34" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-2 col-6">
        <span>Loan Type:</span>
        <select name="work_status" id="main" class="form-control" required
                data-dependent-url="{{ route('lookup.customer-types') }}" data-dependent-target="#sub" data-dependent-param="work_status">
            <option value="">Select loan type</option>
            @foreach (\App\Models\Customer::WORK_STATUSES as $code => $label)
                <option value="{{ $code }}" @selected($value('work_status', 'work_status') === $code)>{{ $label }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-lg-2 col-12">
        <span>Types of customer</span>
        <select name="cust_type" id="sub" class="form-control" required>
            <option value="">Select</option>
            @foreach ($customerTypes as $type)
                <option value="{{ $type->code }}" @selected($value('cust_type', 'customer_type') === $type->code)>{{ $type->name }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-lg-3 col-6">
        <span>Region:</span>
        <select name="region_id" class="form-control select2 input-sm" required>
            <option value="">Select region</option>
            @foreach ($regions as $region)
                <option value="{{ $region->id }}" @selected((string) $value('region_id', 'region_id') === (string) $region->id)>{{ $region->name }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-lg-3 col-6">
        <span>District:</span>
        <input type="text" name="district" value="{{ $value('district', 'district') }}" placeholder="district" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-3 col-6">
        <span>Ward:</span>
        <input type="text" name="ward" value="{{ $value('ward', 'ward') }}" placeholder="Ward" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-3 col-6">
        <span>Street:</span>
        <input type="text" name="street" value="{{ $value('street', 'street') }}" placeholder="street" autocomplete="off" class="form-control input-sm" required>
    </div>
</div>
