@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Bank Account &amp; password</li>
@endsection

@section('content')
    <x-card title="Bank Account List">
        <x-slot:actions>
            <x-header-button target="addcontact1" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Branch</th>
                        <th>Customer name</th>
                        <th>Phone Number</th>
                        <th>Acount name</th>
                        <th>VISA</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($customers as $customer)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $customer->branch?->name }}</td>
                            <td>{{ $customer->full_name }}</td>
                            <td>{{ $customer->phone }}</td>
                            <td>{{ $customer->bank_account_name }}</td>
                            <td>{{ $customer->bank_password }}</td>
                            <td>
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact1{{ $customer->id }}" title="Edit"><i class="icon-pencil"></i></a>
                            </td>
                        </tr>

                        <x-modal :id="'addcontact1'.$customer->id" title="Edit Account & Password" :action="route('visa.update', $customer)" method="PUT" submit="Update">
                            <div class="row clearfix">
                                <div class="col-md-6">
                                    <span>Account Name</span>
                                    <input type="text" name="ac_name" class="form-control" value="{{ $customer->bank_account_name }}" autocomplete="off">
                                </div>
                                <div class="col-md-6">
                                    <span>Password</span>
                                    <input type="text" name="ac_password" class="form-control" value="{{ $customer->bank_password }}" autocomplete="off">
                                </div>
                            </div>
                        </x-modal>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact1" title="Filter" :action="route('visa.index')" method="GET" submit="filter" size="">
        <span>Branch</span>
        <x-branch-select :branches="$branches" placeholder="Select branch" all :selected="request('blanch_id')" />
    </x-modal>
@endsection
