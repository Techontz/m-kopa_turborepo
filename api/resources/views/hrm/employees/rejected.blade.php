@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Rejected Employee</li>
@endsection

@section('content')
    <x-card title="Rejected Employee">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Photo</th>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Phone number</th>
                        <th>Branch</th>
                        <th>Position</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($employees as $employee)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>
                                <div class="profile-image"><img src="{{ $employee->photo_url }}" class="img-thumbnail" alt="customer image" style="width: 70px; height: 70px;"></div>
                            </td>
                            <td class="c">{{ $employee->full_name }}</td>
                            <td>{{ $employee->username }}</td>
                            <td>{{ $employee->phone }}</td>
                            <td class="c">{{ $employee->branch?->name }}</td>
                            <td class="c">{{ $employee->position }}</td>
                            <td><span class="badge badge-danger">Rejected</span></td>
                            <td class="c text-nowrap">{{ $employee->created_at?->format('Y-m-d') }}</td>
                            <td class="text-nowrap">
                                <a href="{{ route('employees.show', $employee) }}" class="btn btn-primary btn-sm" title="View"><i class="icon-eye"></i></a>
                                <x-action-button :action="route('employees.destroy', $employee)" method="DELETE" confirm="Are you sure?" class="btn btn-danger btn-sm" icon="icon-trash" title="Delete" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
