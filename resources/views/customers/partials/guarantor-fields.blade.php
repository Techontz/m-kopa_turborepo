{{-- Guarantor form fields. Expects: $regions, optional $guarantor --}}
@php $guarantor ??= null; @endphp
<div class="row">
    <div class="col-md-4">
        <span>*First Name:</span>
        <input type="text" name="first_name" value="{{ $guarantor?->first_name }}" class="form-control" placeholder="First name" required>
    </div>
    <div class="col-md-4">
        <span>Middle Name:</span>
        <input type="text" name="middle_name" value="{{ $guarantor?->middle_name }}" class="form-control" placeholder="Middle name">
    </div>
    <div class="col-md-4">
        <span>*Last Name:</span>
        <input type="text" name="last_name" value="{{ $guarantor?->last_name }}" class="form-control" placeholder="Last name" required>
    </div>
    <div class="col-md-4">
        <span>*Phone Number:</span>
        <input type="number" name="phone" value="{{ $guarantor?->phone }}" class="form-control" placeholder="Eg.0753(XXXX)34" required>
    </div>
    <div class="col-md-4">
        <span>Gender:</span>
        <select name="gender" class="form-control">
            <option value="">Select Gender</option>
            <option value="male" @selected($guarantor?->gender === 'male')>Male</option>
            <option value="female" @selected($guarantor?->gender === 'female')>Female</option>
        </select>
    </div>
    <div class="col-md-4">
        <span>Martial status:</span>
        <select name="marital_status" class="form-control">
            <option value="">Select</option>
            @foreach (\App\Models\Customer::MARITAL_STATUSES as $status)
                <option value="{{ $status }}" @selected($guarantor?->marital_status === $status)>{{ $status }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-md-4">
        <span>Identification No:</span>
        <input type="text" name="id_number" value="{{ $guarantor?->id_number }}" class="form-control" placeholder="NIDA / Voter ID">
    </div>
    <div class="col-md-4">
        <span>*Relationship:</span>
        <input type="text" name="relationship" value="{{ $guarantor?->relationship }}" class="form-control" placeholder="Relationship" required>
    </div>
    <div class="col-md-4">
        <span>Region:</span>
        <select name="region_id" class="form-control">
            <option value="">Select region</option>
            @foreach ($regions as $region)
                <option value="{{ $region->id }}" @selected($guarantor?->region_id === $region->id)>{{ $region->name }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-md-4">
        <span>District:</span>
        <input type="text" name="district" value="{{ $guarantor?->district }}" class="form-control" placeholder="district">
    </div>
    <div class="col-md-4">
        <span>Ward:</span>
        <input type="text" name="ward" value="{{ $guarantor?->ward }}" class="form-control" placeholder="Ward">
    </div>
    <div class="col-md-4">
        <span>Street:</span>
        <input type="text" name="street" value="{{ $guarantor?->street }}" class="form-control" placeholder="street">
    </div>
</div>
