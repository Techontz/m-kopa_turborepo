@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">All Customer</li>
@endsection

@section('content')
    <x-card :title="'All Customer / '.$duration->label()">
        <x-slot:actions>
            <x-header-button target="addcontact2" />
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>Photo</th>
                        <th>customer name</th>
                        <th>Customer ID</th>
                        <th>Check number</th>
                        <th>Account number</th>
                        <th>Date of birth</th>
                        <th>Age</th>
                        <th>Gender</th>
                        <th>Phone number</th>
                        <th>Loan status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($customers as $customer)
                        <tr>
                            <td><img src="{{ $customer->photo_url }}" class="rounded-circle" style="width: 35px; height: 35px;" alt=""></td>
                            <td><a href="{{ route('customers.show', $customer) }}">{{ $customer->full_name }}</a></td>
                            <td>{{ $customer->customer_code }}</td>
                            <td>{{ $customer->check_number ?? '-' }}</td>
                            <td>{{ $customer->account_number ?? '-' }}</td>
                            <td>{{ $customer->date_of_birth?->toDateString() }}</td>
                            <td>{{ $customer->age }}</td>
                            <td>{{ $customer->gender }}</td>
                            <td>{{ $customer->phone }}</td>
                            <td><span class="badge badge-info">{{ $customer->status_label }}</span></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" :action="url()->current()" method="GET" submit="Filter">
        <select name="customer_status" class="form-control" required>
            <option value="">--Select status--</option>
            <option value="open">ACTIVE</option>
            <option value="out">DEFAULT</option>
            <option value="close">CLOSED</option>
        </select>
    </x-modal>
@endsection
