@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">HRM</li>
    <li class="breadcrumb-item active">Staff Loan Category</li>
@endsection

@php($durations = \App\Enums\Duration::cases())

@section('content')
    <x-card title="Staff Loan Category">
        <form action="{{ route('staff-loan-categories.store') }}" method="POST">
            @csrf
            <div class="form-group form-group-last row">
                <div class="col-lg-3 form-group-sub">
                    <span>*Loan Product name:</span>
                    <input type="text" name="category_name" placeholder="Loan Category product name" autocomplete="off" class="form-control input-sm" value="{{ old('category_name') }}" required>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*From:</span>
                    <input type="number" name="from_amount" placeholder="eg.1000" autocomplete="off" class="form-control input-sm" value="{{ old('from_amount') }}" required>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*To:</span>
                    <input type="number" name="to_amount" placeholder="eg.10000" autocomplete="off" class="form-control input-sm" value="{{ old('to_amount') }}" required>
                </div>
                <div class="col-lg-3 form-group-sub">
                    <span>*Loan Interest(%)</span>
                    <input type="text" name="interest" placeholder="Loan Interest(%)" autocomplete="off" class="form-control input-sm" value="{{ old('interest') }}" required>
                </div>
                <div class="col-lg-3 form-group-sub">
                    <span>*Select Loan Duration</span>
                    <select class="form-control" name="duration" required>
                        <option value="">---Select Loan Duration---</option>
                        @foreach ($durations as $duration)
                            <option value="{{ $duration->value }}" @selected(old('duration') === $duration->value)>{{ $duration->label() }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*Repayment Level</span>
                    <input type="number" class="form-control" placeholder="From" name="from_repayment" value="{{ old('from_repayment') }}" required>
                </div>
                <div class="col-lg-3 col-6">
                    <span>.</span>
                    <input type="number" placeholder="To" class="form-control" name="to_repayment" value="{{ old('to_repayment') }}" required>
                </div>
                <div class="col-lg-3 col-6">
                    <span>.</span>
                    <input type="number" placeholder="Enter charger" class="form-control" name="fee" value="{{ old('fee') }}" required>
                </div>
            </div>
            <div class="text-center mt-3">
                <button type="submit" class="btn btn-primary btn-sm">Save</button>
                <button type="reset" class="btn btn-danger btn-sm">Cancel</button>
            </div>
        </form>
    </x-card>

    <x-card title="Loan Category">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Loan Category name</th>
                        <th>Loan level</th>
                        <th>Loan Interest</th>
                        <th>Duration</th>
                        <th>Repayment Level</th>
                        <th>Charger</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($categories as $category)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $category->name }}</td>
                            <td>{{ money($category->amount_from) }} - {{ money($category->amount_to) }}</td>
                            <td>{{ (float) $category->interest_rate }}%</td>
                            <td>{{ ucfirst($category->duration) }}</td>
                            <td>{{ $category->repayment_from }} - {{ $category->repayment_to }}</td>
                            <td>{{ money($category->fee) }}</td>
                            <td class="text-nowrap">
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact1{{ $category->id }}" title="Edit"><i class="icon-pencil"></i></a>
                                <x-action-button :action="route('staff-loan-categories.destroy', $category)" method="DELETE" confirm="Are You Sure?" icon="icon-trash" />
                            </td>
                        </tr>

                        <x-modal :id="'addcontact1'.$category->id" title="Edit Staff Loan Category" :action="route('staff-loan-categories.update', $category)" method="PUT" submit="Update">
                            <div class="row clearfix">
                                <div class="col-md-4 col-12">
                                    <span>Loan Category Name</span>
                                    <input type="text" class="form-control" autocomplete="off" name="category_name" value="{{ $category->name }}" required>
                                </div>
                                <div class="col-md-4 col-6">
                                    <span>From</span>
                                    <input type="number" class="form-control" autocomplete="off" name="from_amount" value="{{ (float) $category->amount_from }}" required>
                                </div>
                                <div class="col-md-4 col-6">
                                    <span>To</span>
                                    <input type="number" class="form-control" autocomplete="off" name="to_amount" value="{{ (float) $category->amount_to }}" required>
                                </div>
                                <div class="col-md-6 col-6">
                                    <span>Loan Interest(%)</span>
                                    <input type="text" class="form-control" autocomplete="off" name="interest" value="{{ (float) $category->interest_rate }}" required>
                                </div>
                                <div class="col-md-6 col-12">
                                    <span>*Duration:</span>
                                    <select class="form-control" name="duration" required>
                                        @foreach ($durations as $duration)
                                            <option value="{{ $duration->value }}" @selected($category->duration === $duration->value)>{{ $duration->label() }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-md-4 col-6">
                                    <span>*From Repayment:</span>
                                    <input type="number" class="form-control" value="{{ $category->repayment_from }}" name="from_repayment" required>
                                </div>
                                <div class="col-md-4 col-6">
                                    <span>*To Repayment</span>
                                    <input type="number" class="form-control" value="{{ $category->repayment_to }}" name="to_repayment" required>
                                </div>
                                <div class="col-md-4 col-6">
                                    <span>*charger</span>
                                    <input type="number" class="form-control" value="{{ (float) $category->fee }}" name="fee" required>
                                </div>
                            </div>
                        </x-modal>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
