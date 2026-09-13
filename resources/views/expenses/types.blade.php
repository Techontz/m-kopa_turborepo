@extends('layouts.app')

@php
    $crumbs = ['branch' => ['Expenses'], 'hq' => ['Headquater Expenses'], 'bank' => ['Bank', 'Register Bank Expenses']][$scope];
@endphp

@section('breadcrumb')
    @foreach ($crumbs as $crumb)
        <li class="breadcrumb-item active">{{ $crumb }}</li>
    @endforeach
@endsection

@section('content')
    <x-card :title="$scope === 'bank' ? 'Expensess' : 'Expenses'">
        <x-slot:actions>
            <x-header-button target="addcontact2" icon="icon-plus" />
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>{{ $scope === 'bank' ? 'S/no.' : 'S/No.' }}</th>
                        <th>Expenses</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($types as $type)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $type->name }}</td>
                            <td class="text-nowrap">
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#editExpense{{ $type->id }}"><i class="icon-pencil"></i></a>
                                <x-action-button :action="route('expense-types.destroy', $type)" method="DELETE" confirm="Are you sure?" icon="icon-trash" />
                            </td>
                        </tr>

                        <x-modal :id="'editExpense'.$type->id" title="Edit Expenses" :action="route('expense-types.update', $type)" method="PUT" submit="Update" size="">
                            <input type="hidden" name="scope" value="{{ $scope }}">
                            <span>Expenses:</span>
                            <input type="text" name="{{ $field }}" class="form-control" placeholder="Enter Expenses" value="{{ $type->name }}" autocomplete="off" required>
                        </x-modal>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" title="Register Expenses" :action="route('expense-types.store')" submit="Save" size="">
        <input type="hidden" name="scope" value="{{ $scope }}">
        <span>Expenses:</span>
        <input type="text" name="{{ $field }}" class="form-control" placeholder="Enter Expenses" autocomplete="off" required>
    </x-modal>
@endsection
