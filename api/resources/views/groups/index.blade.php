@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Group</li>
    <li class="breadcrumb-item active">Group List</li>
@endsection

@section('content')
    <x-card title="Group List">
        <x-slot:actions>
            <x-header-button target="addcontact1" icon="icon-plus" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/NO.</th>
                        <th>Group Name</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($groups as $group)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $group->name }}</td>
                            <td class="text-nowrap">
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact2{{ $group->id }}"><i class="icon-pencil"></i></a>
                                <a href="{{ route('groups.show', $group) }}" title="view" class="btn btn-sm btn-info"><i class="icon-eye"></i></a>
                                <x-action-button :action="route('groups.destroy', $group)" method="DELETE" confirm="Are you sure?" icon="icon-trash" class="btn btn-sm btn-danger" />
                            </td>
                        </tr>

                        <x-modal :id="'addcontact2'.$group->id" title="Edit Group" :action="route('groups.update', $group)" method="PUT" submit="Update" size="">
                            <div class="row clearfix">
                                <div class="col-md-12">
                                    <span>Group Name</span>
                                    <input type="text" name="group_name" class="form-control" placeholder="Enter Group Name" value="{{ $group->name }}" autocomplete="off" required>
                                </div>
                            </div>
                        </x-modal>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact1" title="Register Group" :action="route('groups.store')" submit="Save" size="">
        <div class="row clearfix">
            <div class="col-md-12">
                <span>Group Name</span>
                <input type="text" name="group_name" class="form-control" placeholder="Enter Group Name" value="{{ old('group_name') }}" autocomplete="off" required>
            </div>
        </div>
    </x-modal>
@endsection
