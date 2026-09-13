@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Salary Advance</li>
    <li class="breadcrumb-item active">Salary advance Category</li>
@endsection

@section('content')
    <x-card title="Salary advance Category List">
        <x-slot:actions>
            <x-header-button target="addcontact2" icon="icon-plus" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Category name</th>
                        <th>Interest</th>
                        <th>From Amount</th>
                        <th>To Amount</th>
                        <th>charger Fee</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($categories as $category)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $category->name }}</td>
                            <td>{{ (float) $category->interest_rate }}%</td>
                            <td>{{ money($category->amount_from) }}</td>
                            <td>{{ money($category->amount_to) }}</td>
                            <td>{{ money($category->fee) }}</td>
                            <td class="text-nowrap">
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-info" data-toggle="modal" data-target="#addcontact1{{ $category->id }}"><i class="icon-pencil"></i></a>
                                <x-action-button :action="route('salary-advance-categories.destroy', $category)" method="DELETE" confirm="Are you sure?" icon="icon-trash" />
                            </td>
                        </tr>

                        <x-modal :id="'addcontact1'.$category->id" title="Edit Pending Debist Category" :action="route('salary-advance-categories.update', $category)" method="PUT" submit="Update" size="">
                            <div class="row clearfix">
                                <div class="col-md-12">
                                    <span>Loan Product name:</span>
                                    <input type="text" name="perferal_name" class="form-control" placeholder="Enter Category" value="{{ $category->name }}" required>
                                </div>
                                <div class="col-md-12">
                                    <span>Loan Interest(%):</span>
                                    <input type="text" name="interest_name" class="form-control" placeholder="Enter Interest" value="{{ (float) $category->interest_rate }}" required>
                                </div>
                                <div class="col-md-12">
                                    <span>From Amount:</span>
                                    <input type="text" name="from_amount" class="form-control" placeholder="Enter Interest" value="{{ (float) $category->amount_from }}" required>
                                </div>
                                <div class="col-md-12">
                                    <span>To Amount:</span>
                                    <input type="text" name="to_amount" class="form-control" placeholder="Enter Interest" value="{{ (float) $category->amount_to }}" required>
                                </div>
                                <div class="col-md-12">
                                    <span>charger Fee:</span>
                                    <input type="number" name="fee_charger" class="form-control" placeholder="Enter chargers" value="{{ (float) $category->fee }}" required>
                                </div>
                            </div>
                        </x-modal>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" title="Pending Debist Category" :action="route('salary-advance-categories.store')" submit="Save" size="">
        <div class="row clearfix">
            <div class="col-md-12">
                <span>Loan Product name:</span>
                <input type="text" name="perferal_name" class="form-control" placeholder="Enter Category" value="{{ old('perferal_name') }}" required>
            </div>
            <div class="col-md-12">
                <span>Loan Interest(%):</span>
                <input type="text" name="interest_name" class="form-control" placeholder="Enter Interest" value="{{ old('interest_name') }}" required>
            </div>
            <div class="col-md-12">
                <span>From Amount</span>
                <input type="number" name="from_amount" class="form-control" placeholder="Enter Amount" value="{{ old('from_amount') }}" required>
            </div>
            <div class="col-md-12">
                <span>To Amount</span>
                <input type="number" name="to_amount" class="form-control" placeholder="Enter Amount" value="{{ old('to_amount') }}" required>
            </div>
            <div class="col-md-12">
                <span>charger Fee:</span>
                <input type="number" name="fee_charger" class="form-control" placeholder="Enter charger Fee" value="{{ old('fee_charger') }}" required>
            </div>
        </div>
    </x-modal>
@endsection
