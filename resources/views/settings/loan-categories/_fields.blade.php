@php
    /** @var \App\Models\LoanCategory|null $category */
    $category ??= null;
    $yesNo = fn (?bool $value): ?string => $value === null ? null : ($value ? 'YES' : 'NO');
@endphp
<div class="row">
    <div class="col-lg-3 form-group-sub">
        <span>*Loan Product name:</span>
        <input type="text" name="loan_name" value="{{ old('loan_name', $category?->name) }}" placeholder="Loan Category product name" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-3 col-6">
        <span>*From:</span>
        <input type="{{ $category ? 'number' : 'text' }}" name="loan_price" value="{{ old('loan_price', $category ? (float) $category->amount_from : null) }}" placeholder="eg.1000" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-3 col-6">
        <span>*To:</span>
        <input type="{{ $category ? 'number' : 'text' }}" name="loan_perday" value="{{ old('loan_perday', $category ? (float) $category->amount_to : null) }}" placeholder="eg.10000" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-3 form-group-sub">
        <span>*Loan Interest(%)</span>
        <input type="text" name="interest_formular" value="{{ old('interest_formular', $category ? (float) $category->interest_rate : null) }}" placeholder="Loan Interest(%)" autocomplete="off" class="form-control input-sm" required>
    </div>
    <div class="col-lg-3 form-group-sub">
        <span>*Interest Formular</span>
        <select class="form-control" name="formular" required>
            @unless ($category)
                <option value="">---Select Interest Formular---</option>
            @endunless
            @foreach ($formulas as $formula)
                <option value="{{ $formula->code }}" @selected(old('formular', $category?->formula) === $formula->code)>{{ $formula->name }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-lg-3 form-group-sub">
        <span>*Select Loan Duration</span>
        <select class="form-control" name="duration" required>
            @unless ($category)
                <option value="">---Select Loan Duration---</option>
            @endunless
            @foreach ($durations as $duration)
                <option value="{{ $duration->value }}" @selected(old('duration', $category?->duration->value) === $duration->value)>{{ $duration->label() }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-lg-3 col-6">
        <span>*Repayment Level</span>
        <input type="number" class="form-control" placeholder="From" value="{{ old('from_repayment', $category?->repayment_from) }}" name="from_repayment" required>
    </div>
    <div class="col-lg-3 col-6">
        <span>.</span>
        <input type="number" placeholder="To" class="form-control" value="{{ old('to_repayment', $category?->repayment_to) }}" name="to_repayment" required>
    </div>
    <div class="col-lg-4 col-6">
        <span>You Allow Deduction?</span>
        <select class="form-control" name="fee_deduct" required>
            @unless ($category)
                <option value="">Select</option>
            @endunless
            @foreach (['YES', 'NO'] as $option)
                <option value="{{ $option }}" @selected(old('fee_deduct', $yesNo($category?->fee_deduct)) === $option)>{{ $option }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-lg-4 col-6">
        <span>You Allow Penarty?</span>
        <select class="form-control" name="penart" required>
            @unless ($category)
                <option value="">Select</option>
            @endunless
            @foreach (['YES', 'NO'] as $option)
                <option value="{{ $option }}" @selected(old('penart', $yesNo($category?->has_penalty)) === $option)>{{ $option }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-lg-4 col-6">
        <span>Aprove status</span>
        <select class="form-control" name="aprove_status" required>
            @unless ($category)
                <option value="">Select</option>
            @endunless
            @foreach ($approveLevels as $value => $label)
                <option value="{{ $value }}" @selected(old('aprove_status', $category?->approve_level) === $value)>{{ $label }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-lg-4 col-6">
        <span>Topup percent(%)</span>
        <input type="text" name="topup_percent" value="{{ old('topup_percent', $category ? (float) $category->topup_percent : null) }}" class="form-control" placeholder="topup percent" required>
    </div>
    <div class="col-lg-4 col-6">
        <span>Take home Percent(%)</span>
        <input type="text" name="take_home_percent" value="{{ old('take_home_percent', $category ? (float) $category->take_home_percent : null) }}" class="form-control" placeholder="Take home percent" required>
    </div>
    <div class="col-lg-4 col-6">
        <span>Types of loans</span>
        <select class="form-control" name="main_id" required>
            @unless ($category)
                <option value="">Select</option>
            @endunless
            @foreach ($mainCategories as $mainCategory)
                <option value="{{ $mainCategory->id }}" @selected((string) old('main_id', $category?->main_category_id) === (string) $mainCategory->id)>{{ $mainCategory->name }}</option>
            @endforeach
        </select>
    </div>
</div>
