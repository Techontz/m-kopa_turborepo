@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Branch</li>
@endsection

@section('content')
    <x-card title="Register Branch">
        <form action="{{ route('branches.store') }}" method="POST">
            @csrf
            <div class="row">
                <div class="col-md-3">
                    <span>* Branch name:</span>
                    <input type="text" name="blanch_name" class="form-control" placeholder="Branch name" value="{{ old('blanch_name') }}" required>
                </div>
                <div class="col-md-3">
                    <span>* Branch region:</span>
                    <select name="region_id" class="form-control select2" required>
                        <option value="">Select Region</option>
                        @foreach ($regions as $region)
                            <option value="{{ $region->id }}" @selected(old('region_id') == $region->id)>{{ $region->name }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-3">
                    <span>* Branch Phone Number:</span>
                    <input type="number" name="blanch_no" class="form-control" placeholder="Blanch phone number" value="{{ old('blanch_no') }}" required>
                </div>
                <div class="col-md-3">
                    <span>* Branch Type:</span>
                    <select name="branch_type" class="form-control" required>
                        <option value="">select</option>
                        <option value="main">Main Branch</option>
                        <option value="sub">Sub Branch</option>
                    </select>
                </div>
            </div>
            <div class="text-center m-t-20">
                <button type="submit" class="btn btn-primary"><i class="icon-plus"></i>Save</button>
            </div>
        </form>
    </x-card>

    <x-card title="Branch List">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Branch Name</th>
                        <th>Branch Phone Number</th>
                        <th>Branch region</th>
                        <th>Customer Status</th>
                        <th>Branch type</th>
                        <th>status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($branches as $branch)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $branch->name }}</td>
                            <td>{{ $branch->phone }}</td>
                            <td>{{ $branch->region?->name }}</td>
                            <td class="text-nowrap">
                                Active: <span class="badge badge-success">{{ $branch->active_count }}</span>
                                Pending: <span class="badge badge-warning">{{ $branch->pending_count }}</span>
                                Default: <span class="badge badge-danger">{{ $branch->default_count }}</span>
                                Done: <span class="badge badge-info">{{ $branch->done_count }}</span>
                                All:: <span class="badge badge-dark">{{ $branch->all_count }}</span>
                            </td>
                            <td>{{ $branch->type === 'main' ? 'MAIN BRANCH' : 'SUB-BRANCH' }}</td>
                            <td><span class="badge badge-success">{{ strtoupper($branch->status) }}</span></td>
                            <td class="text-nowrap">
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#editBranch{{ $branch->id }}"><i class="icon-pencil"></i></a>
                                <x-action-button :action="route('branches.destroy', $branch)" method="DELETE" confirm="Are you sure?" icon="icon-trash" />
                            </td>
                        </tr>

                        <x-modal :id="'editBranch'.$branch->id" title="Edit Branch" :action="route('branches.update', $branch)" method="PUT" submit="Update">
                            <div class="row">
                                <div class="col-md-6">
                                    <span>* Branch name:</span>
                                    <input type="text" name="blanch_name" class="form-control" value="{{ $branch->name }}" required>
                                </div>
                                <div class="col-md-6">
                                    <span>* Branch region:</span>
                                    <select name="region_id" class="form-control" required>
                                        @foreach ($regions as $region)
                                            <option value="{{ $region->id }}" @selected($branch->region_id === $region->id)>{{ $region->name }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <span>* Branch Phone Number:</span>
                                    <input type="number" name="blanch_no" class="form-control" value="{{ $branch->phone }}" required>
                                </div>
                                <div class="col-md-6">
                                    <span>* Branch Type:</span>
                                    <select name="branch_type" class="form-control" required>
                                        <option value="main" @selected($branch->type === 'main')>Main Branch</option>
                                        <option value="sub" @selected($branch->type === 'sub')>Sub Branch</option>
                                    </select>
                                </div>
                            </div>
                        </x-modal>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
