@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">All Customer</li>
@endsection

@section('content')
    <x-card title="Customer List">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Customer ID</th>
                        <th>customer name</th>
                        <th>Age</th>
                        <th>Gender</th>
                        <th>Phone number</th>
                        <th>Branch</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($customers as $customer)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $customer->customer_code }}</td>
                            <td><a href="{{ route('reports.development.show', $customer) }}">{{ $customer->full_name }}</a></td>
                            <td>{{ $customer->age }}</td>
                            <td>{{ $customer->gender }}</td>
                            <td>{{ $customer->phone }}</td>
                            <td>{{ $customer->branch?->name }}</td>
                            <td>
                                <a href="{{ route('reports.development.show', $customer) }}" class="btn btn-sm btn-icon btn-pure btn-primary on-default m-r-5 button-edit"><i class="icon-eye"></i></a>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
