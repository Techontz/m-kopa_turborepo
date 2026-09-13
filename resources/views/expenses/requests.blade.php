@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Recomended Expenses</li>
@endsection

@section('content')
    <x-card title="Request Expenses">
        <x-slot:actions>
            <x-header-button target="addcontact1" icon="icon-pencil" />
        </x-slot:actions>
        @include('expenses.partials.branch-table')
    </x-card>

    <x-modal id="addcontact1" title="Request Expenses" :action="route('expense-requests.store')" submit="Request" size="">
        <input type="hidden" name="scope" value="branch">
        <div class="row clearfix">
            <div class="col-lg-12 col-12">
                <div class="form-group">
                    <span>Select Branch:</span>
                    <x-branch-select :branches="$branches" />
                </div>
            </div>
            <div class="col-lg-6 col-6">
                <div class="form-group">
                    <span>Select Expenses:</span>
                    <select name="ex_id" class="form-control" required>
                        <option value="">Select Expenses</option>
                        @foreach ($expenseTypes as $expenseType)
                            <option value="{{ $expenseType->id }}" @selected((string) old('ex_id') === (string) $expenseType->id)>{{ $expenseType->name }}</option>
                        @endforeach
                    </select>
                </div>
            </div>
            <div class="col-lg-6 col-6">
                <div class="form-group">
                    <span>Amount:</span>
                    <input type="number" name="req_amount" class="form-control" placeholder="Amount" value="{{ old('req_amount') }}" autocomplete="off" required>
                </div>
            </div>
            <div class="col-lg-12 col-12">
                <div class="form-group">
                    <span>Description:</span>
                    <textarea name="req_description" class="form-control" rows="4" placeholder="Description" autocomplete="off" required>{{ old('req_description') }}</textarea>
                </div>
            </div>
        </div>
    </x-modal>
@endsection
