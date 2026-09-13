@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Bank</li>
    <li class="breadcrumb-item active">Register Account</li>
@endsection

@section('content')
    <x-card title="Account List">
        <x-slot:actions>
            <x-header-button target="addcontact2" icon="icon-plus" />
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Account Name</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($accounts as $account)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $account->name }}</td>
                            <td class="text-nowrap">
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#editAccount{{ $account->id }}"><i class="icon-pencil"></i></a>
                                <x-action-button :action="route('bank-accounts.destroy', $account)" method="DELETE" confirm="Are you sure?" icon="icon-trash" />
                            </td>
                        </tr>

                        <x-modal :id="'editAccount'.$account->id" title="Edit Account" :action="route('bank-accounts.update', $account)" method="PUT" submit="Update">
                            <span>Account:</span>
                            <input type="text" name="ac_name" class="form-control" placeholder="Enter Account name" value="{{ $account->name }}" required>
                        </x-modal>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" title="Register Account" :action="route('bank-accounts.store')" submit="Save" size="">
        <span>Account:</span>
        <input type="text" name="ac_name" class="form-control" placeholder="Enter Account name" value="{{ old('ac_name') }}" required>
    </x-modal>
@endsection
