@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">All Customer</li>
@endsection

@php
    $statusBadges = ['pending' => ['warning', 'PENDING'], 'open' => ['success', 'ACTIVE'], 'out' => ['danger', 'DEFAULT'], 'close' => ['primary', 'DONE']];
@endphp

@section('content')
    <x-card title="All Customer">
        <x-slot:actions>
            <x-header-button target="addcontact2" />
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Customer ID</th>
                        <th>customer name</th>
                        <th>Date of Birth</th>
                        <th>Age</th>
                        <th>Gender</th>
                        <th>Phone number</th>
                        <th>Branch</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($customers as $customer)
                        @php [$badge, $label] = $statusBadges[$customer->status] ?? ['default', strtoupper($customer->status)]; @endphp
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $customer->customer_code }}</td>
                            <td><a href="{{ route('customers.show', $customer) }}">{{ $customer->full_name }}</a></td>
                            <td>{{ $customer->date_of_birth?->toDateString() }}</td>
                            <td>{{ $customer->age }}</td>
                            <td>{{ $customer->gender }}</td>
                            <td>{{ $customer->phone }}</td>
                            <td>{{ $customer->branch?->name }}</td>
                            <td><span class="badge badge-{{ $badge }}">{{ $label }}</span></td>
                            <td class="text-nowrap">
                                <a href="{{ route('customers.show', $customer) }}" class="btn btn-sm btn-icon btn-primary"><i class="icon-eye"></i></a>
                                <x-action-button :action="route('customers.destroy', $customer)" method="DELETE" confirm="Are you sure?" icon="icon-trash" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" :action="route('customers.index')" method="GET" submit="Filter">
        <div class="row">
            <div class="col-md-6">
                <x-branch-select :branches="$branches" placeholder="--Select Branch--" all :selected="request('blanch_id')" />
            </div>
            <div class="col-md-6">
                <select name="customer_status" class="form-control" required>
                    <option value="">--Select status--</option>
                    <option value="open" @selected(request('customer_status') === 'open')>ACTIVE</option>
                    <option value="out" @selected(request('customer_status') === 'out')>DEFAULT</option>
                    <option value="close" @selected(request('customer_status') === 'close')>CLOSED</option>
                </select>
            </div>
        </div>
    </x-modal>
@endsection
