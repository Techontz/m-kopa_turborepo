@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan</li>
    <li class="breadcrumb-item active">Loan Application Form</li>
@endsection

@section('content')
    <x-card title="Loan Application Form">
        <form action="{{ route('loans.store', $customer) }}" method="POST">
            @csrf
            <div class="row">
                <div class="col-lg-3 col-6">
                    <span>*Loan category:</span>
                    <select name="category_id" id="category" class="form-control" required
                            data-dependent-url="{{ route('lookup.category-formulas') }},{{ route('lookup.category-durations') }},{{ route('lookup.category-fees') }}"
                            data-dependent-target="#formular,#duration,#fee" data-dependent-param="category_id">
                        <option value="">Select Loan Category</option>
                        @foreach ($categories as $category)
                            <option value="{{ $category->id }}" @selected(old('category_id') == $category->id)>{{ $category->option_label }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*Group:</span>
                    <select name="group_id" class="form-control">
                        <option value="">Select Group</option>
                        @foreach ($groups as $group)
                            <option value="{{ $group->id }}" @selected(old('group_id') == $group->id)>{{ strtolower($group->name) }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*Loan Amount Applied:</span>
                    <input type="number" name="how_loan" value="{{ old('how_loan') }}" class="form-control" placeholder="Loan Amount Applied" autocomplete="off" required>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*Loan Duration:</span>
                    <select name="day" id="duration" class="form-control" required>
                        <option value="">Select Duration</option>
                    </select>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*Number of Repayments:</span>
                    <input type="number" name="session" value="{{ old('session') }}" class="form-control" placeholder="Enter Number of Repayments" autocomplete="off" required>
                </div>
                <div class="col-lg-3 col-6">
                    <span class="font-weight-bold">*Interest Formular:</span>
                    <select name="rate" id="formular" class="form-control" required>
                        <option value="">Interest Formular</option>
                    </select>
                </div>
                <div class="col-lg-3 col-6">
                    <span class="font-weight-bold">*Deducted Fee:</span>
                    <select name="fee_status" id="fee" class="form-control" required>
                        <option value="">Select</option>
                    </select>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*Reason of Applying Loan:</span>
                    <input type="text" name="reason" value="{{ old('reason') }}" class="form-control" placeholder="Reason of Applying Loan:" autocomplete="off" required>
                </div>
            </div>
            <div class="text-center m-t-20">
                <button type="submit" class="btn btn-primary">Next</button>
                <a href="{{ route('customers.show', $customer) }}" class="btn btn-danger">Cancel</a>
            </div>
        </form>
    </x-card>
@endsection
