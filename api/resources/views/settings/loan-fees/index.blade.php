@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan Fee Setup</li>
@endsection

@php
    $modeValue = $company->loan_fee_mode === 'general' ? 'GENERAL' : 'LOAN PRODUCT';
@endphp

@section('content')
    <div class="row clearfix">
        <div class="col-md-6">
            <x-card title="Add Loan Fee Category">
                <form action="{{ route('loan-fees.mode') }}" method="POST">
                    @csrf
                    @method('PUT')
                    <div class="row">
                        <div class="col-md-12">
                            <div class="form-group">
                                <label class="font-weight-bold">Loan Fee Category</label>
                                <select class="form-control" name="fee_category" required onchange="this.form.submit()">
                                    <option value="">---Select Loan fee Category---</option>
                                    <option value="LOAN PRODUCT">Loan Fee By Loan Product</option>
                                    <option value="GENERAL">Loan Fee By General</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </form>
            </x-card>
        </div>
        <div class="col-lg-6">
            <x-card title="Loan Fee Category">
                <div class="table-responsive">
                    <table class="table table-hover dataTable table-custom">
                        <thead class="thead-info">
                            <tr>
                                <th>Loan Fee Category</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{{ $modeValue === 'GENERAL' ? 'LOAN FEE BY GENERAL' : 'LOAN FEE BY LOAN PRODUCT' }}</td>
                                <td>
                                    <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact13"><i class="icon-pencil"></i></a>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </x-card>
        </div>
        <div class="col-lg-12">
            <x-card title="Loan Fee Category">
                <div class="table-responsive">
                    <table class="table table-hover js-basic-example dataTable table-custom">
                        <thead class="thead-info">
                            <tr>
                                <th>S/No.</th>
                                <th>Loan Category name</th>
                                <th>Loan level</th>
                                <th>Loan Interest</th>
                                <th>Loan Fee Type</th>
                                <th>Loan Fee</th>
                                <th>Insurance</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($categories as $category)
                                <tr>
                                    <td>{{ $loop->iteration }}.</td>
                                    <td>{{ $category->name }}</td>
                                    <td>{{ $category->level_label }}</td>
                                    <td>{{ (float) $category->interest_rate }}%</td>
                                    <td>{{ $category->fee_type === 'percentage' ? 'PERCENTAGE VALUE' : 'MONEY VALUE' }}</td>
                                    <td>{{ $category->fee_type === 'percentage' ? (float) $category->fee_value.' / %' : money($category->fee_value).' / Tsh' }}</td>
                                    <td>{{ money($category->insurance) }}</td>
                                    <td>
                                        <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact4{{ $category->id }}"><i class="icon-pencil"></i></a>
                                    </td>
                                </tr>

                                <x-modal :id="'addcontact4'.$category->id" title="Edit Loan Fee Category" :action="route('loan-fees.update', $category)" method="PUT" submit="Update">
                                    <div class="row clearfix">
                                        <div class="col-lg-3">
                                            <label class="form-control-label">*Loan Category Name:</label>
                                            <input type="text" class="form-control" autocomplete="off" name="loan_name" value="{{ $category->name }}" required>
                                        </div>
                                        <div class="col-lg-3">
                                            <label class="form-control-label">*From:</label>
                                            <input type="number" class="form-control" autocomplete="off" name="loan_price" value="{{ (float) $category->amount_from }}" required>
                                        </div>
                                        <div class="col-lg-3">
                                            <label class="form-control-label">*To:</label>
                                            <input type="text" class="form-control" autocomplete="off" name="loan_perday" value="{{ (float) $category->amount_to }}" required>
                                        </div>
                                        <div class="col-lg-3">
                                            <label class="form-control-label">*Loan Interest(%):</label>
                                            <input type="number" step="any" class="form-control" autocomplete="off" name="interest_formular" value="{{ (float) $category->interest_rate }}" required>
                                        </div>
                                        <div class="col-lg-4">
                                            <label class="form-control-label">*Loan Fee Type:</label>
                                            <select name="fee_category_type" class="form-control">
                                                <option value="MONEY" @selected($category->fee_type !== 'percentage')>MONEY VALUE</option>
                                                <option value="PERCENTAGE" @selected($category->fee_type === 'percentage')>PERCENTAGE VALUE</option>
                                            </select>
                                        </div>
                                        <div class="col-lg-4">
                                            <label class="form-control-label">*Loan Fee:</label>
                                            <input type="number" step="any" class="form-control" autocomplete="off" name="fee_value" value="{{ (float) $category->fee_value }}" required>
                                        </div>
                                        <div class="col-lg-4">
                                            <label class="form-control-label">*Insurance:</label>
                                            <input type="number" step="any" class="form-control" autocomplete="off" name="insurance" value="{{ (float) $category->insurance }}" required>
                                        </div>
                                    </div>
                                </x-modal>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </x-card>
        </div>
    </div>

    <x-modal id="addcontact13" title="Edit Loan Fee Category" :action="route('loan-fees.mode')" method="PUT" submit="Update" size="">
        <div class="row clearfix">
            <div class="col-md-12">
                <label>Loan Fee Category</label>
                <select class="form-control" name="fee_category" required>
                    <option value="">---Select Loan fee Category---</option>
                    <option value="LOAN PRODUCT" @selected($modeValue === 'LOAN PRODUCT')>Loan Fee By Loan Product</option>
                    <option value="GENERAL" @selected($modeValue === 'GENERAL')>Loan Fee By General</option>
                </select>
            </div>
        </div>
    </x-modal>
@endsection
