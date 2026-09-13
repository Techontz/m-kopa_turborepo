@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Branch &amp; Employee</li>
@endsection

@section('content')
    <x-card title="Branch List">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Branch Name</th>
                        <th>Branch Phone Number</th>
                        <th>Branch region</th>
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
                            <td>
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact{{ $branch->id }}"><i class="icon-eye"></i></a>
                            </td>
                        </tr>

                        <x-modal :id="'addcontact'.$branch->id" :title="$branch->name">
                            <div class="table-responsive">
                                <table class="table table-hover js-basic-example dataTable table-custom">
                                    <thead class="thead-info">
                                        <tr>
                                            <th>S/No.</th>
                                            <th>Photo</th>
                                            <th>Name</th>
                                            <th>Username</th>
                                            <th>Phone number</th>
                                            <th>Position</th>
                                            <th>Gender</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach ($branch->employees as $employee)
                                            <tr>
                                                <td>{{ $loop->iteration }}.</td>
                                                <td><img src="{{ $employee->photo_url }}" class="img-thumbnail" alt="" style="width: 50px; height: 50px;"></td>
                                                <td class="c">{{ $employee->full_name }}</td>
                                                <td>{{ $employee->username }}</td>
                                                <td>{{ $employee->phone }}</td>
                                                <td class="c">{{ $employee->position }}</td>
                                                <td>{{ $employee->gender }}</td>
                                                <td>
                                                    <span class="badge {{ $employee->status === 'active' ? 'badge-success' : 'badge-danger' }}">{{ $employee->status }}</span>
                                                </td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        </x-modal>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
