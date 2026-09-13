@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Employee Privillage</li>
@endsection

@section('content')
    <div class="row clearfix">
        <div class="col-lg-6">
            <x-card title="Privillage List">
                <x-slot:actions>
                    <li><a href="{{ route('employees.index') }}" class="btn btn-primary btn-sm"><i class="icon-logout"></i>Back</a></li>
                </x-slot:actions>

                <div class="table-responsive">
                    <table class="table table-hover js-basic-example dataTable table-custom">
                        <thead class="thead-info">
                            <tr>
                                <th>Privillage</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach (\App\Models\Employee::PRIVILEGES as $key => $label)
                                <tr>
                                    <td>{{ $label }}</td>
                                    <td>
                                        <form action="{{ route('employees.privileges.add', $employee) }}" method="POST" class="d-inline">
                                            @csrf
                                            <input type="hidden" name="privilege" value="{{ $key }}">
                                            <button type="submit" class="btn btn-primary btn-sm"><i class="icon-pencil"></i>Add</button>
                                        </form>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </x-card>
        </div>
        <div class="col-lg-6">
            <x-card :title="'Privillage For ('.$employee->first_name.')'">
                <div class="table-responsive">
                    <table class="table table-hover js-basic-example dataTable table-custom">
                        <thead class="thead-info">
                            <tr>
                                <th>S/No.</th>
                                <th>Privillage</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($assigned as $privilege)
                                <tr>
                                    <td>{{ $loop->iteration }}.</td>
                                    <td class="c">{{ $privilege->privilege }}</td>
                                    <td>
                                        <x-action-button :action="route('employees.privileges.remove', [$employee, $privilege])" method="DELETE" confirm="Are You Sure?" class="btn btn-danger btn-sm" icon="icon-trash" />
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </x-card>
        </div>
    </div>
@endsection
