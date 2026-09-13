@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">HRM</li>
    <li class="breadcrumb-item active">Staff salary Advance Category</li>
@endsection

@section('content')
    <x-card title="Staff salary Advance Category">
        <form action="{{ route('staff-salary-advance-categories.store') }}" method="POST">
            @csrf
            <div class="form-group form-group-last row">
                <div class="col-lg-3 form-group-sub">
                    <span>*Category name:</span>
                    <input type="text" name="cate_name" placeholder="Loan Category product name" autocomplete="off" class="form-control input-sm" value="{{ old('cate_name') }}" required>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*From Amount:</span>
                    <input type="number" name="from_amount" placeholder="eg.0" autocomplete="off" class="form-control input-sm" value="{{ old('from_amount') }}" required>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*To Amount:</span>
                    <input type="number" name="to_amount" placeholder="eg.10000" autocomplete="off" class="form-control input-sm" value="{{ old('to_amount') }}" required>
                </div>
                <div class="col-lg-3 col-6">
                    <span>charger</span>
                    <input type="number" placeholder="Enter charger" class="form-control" name="fee" value="{{ old('fee') }}" required>
                </div>
            </div>
            <div class="text-center mt-3">
                <button type="submit" class="btn btn-primary btn-sm">Save</button>
                <button type="reset" class="btn btn-danger btn-sm">Cancel</button>
            </div>
        </form>
    </x-card>

    <x-card title="category list">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Category name</th>
                        <th>From Amount</th>
                        <th>To Amount</th>
                        <th>Chargers</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($categories as $category)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $category->name }}</td>
                            <td>{{ money($category->amount_from) }}</td>
                            <td>{{ money($category->amount_to) }}</td>
                            <td>{{ money($category->fee) }}</td>
                            <td class="text-nowrap">
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact1{{ $category->id }}" title="Edit"><i class="icon-pencil"></i></a>
                                <x-action-button :action="route('staff-salary-advance-categories.destroy', $category)" method="DELETE" confirm="Are You Sure?" icon="icon-trash" />
                            </td>
                        </tr>

                        <x-modal :id="'addcontact1'.$category->id" title="Edit Category" :action="route('staff-salary-advance-categories.update', $category)" method="PUT" submit="Update" size="">
                            <div class="row clearfix">
                                <div class="col-md-6 col-12">
                                    <span>Category Name</span>
                                    <input type="text" class="form-control" autocomplete="off" name="cate_name" value="{{ $category->name }}" required>
                                </div>
                                <div class="col-md-6 col-6">
                                    <span>From</span>
                                    <input type="number" class="form-control" autocomplete="off" name="from_amount" value="{{ (float) $category->amount_from }}" required>
                                </div>
                                <div class="col-md-6 col-6">
                                    <span>To</span>
                                    <input type="number" class="form-control" autocomplete="off" name="to_amount" value="{{ (float) $category->amount_to }}" required>
                                </div>
                                <div class="col-md-6 col-6">
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
