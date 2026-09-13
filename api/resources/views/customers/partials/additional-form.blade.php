{{-- Aditinal Detail fields. Expects: $customer --}}
<div class="row">
    <div class="col-lg-3 col-12">
        <span>Nick name:</span>
        <input type="text" name="famous_area" value="{{ old('famous_area', $customer->nickname) }}" autocomplete="off" class="form-control input-sm" placeholder="Eg. John Doe" required>
    </div>
    <div class="col-lg-3 col-12">
        <span>Martial Status:</span>
        <select name="martial_status" class="form-control" required>
            @foreach (\App\Models\Customer::MARITAL_STATUSES as $status)
                <option value="{{ $status }}" @selected(old('martial_status', $customer->marital_status) === $status)>{{ $status }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-lg-3 col-6">
        <span>Account Type:</span>
        <select name="account_id" class="form-control input-sm" required readonly>
            <option value="1">LOAN ACCOUNT</option>
        </select>
    </div>
    <div class="col-lg-3 col-6">
        <span>Busines Type:</span>
        <input type="text" name="bussiness_type" value="{{ old('bussiness_type', $customer->business_type) }}" placeholder="busines type" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-4 col-12">
        <span>Place of Busines:</span>
        <input type="text" name="place_imployment" value="{{ old('place_imployment', $customer->place_of_business) }}" placeholder="Place Imployment" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-4 col-12">
        <span>Number of Dependents:</span>
        <input type="number" name="number_dependents" value="{{ old('number_dependents', $customer->dependents) }}" placeholder="Number of Dependents" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-4 col-12">
        <span>Monthly income:</span>
        <input type="text" name="month_income" value="{{ old('month_income', $customer->monthly_income !== null ? money($customer->monthly_income) : '') }}" placeholder="Monthly Income" autocomplete="off" class="form-control js-money-input">
    </div>
</div>
