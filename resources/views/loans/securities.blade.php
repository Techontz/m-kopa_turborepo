@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan</li>
    <li class="breadcrumb-item active">Loan Application Form</li>
@endsection

@php
    $availableGuarantors = $loan->customer->guarantors->whereNull('loan_id');
@endphp

@section('content')
    <x-card :title="'Guarantors List / '.$loan->customer->full_name.' / '.$loan->category->name.' / '.money($loan->amount_applied)">
        <x-slot:actions>
            <x-header-button target="add-guarantor" icon="icon-plus" />
        </x-slot:actions>
        @if ($availableGuarantors->isNotEmpty())
            <form action="{{ route('loans.securities.guarantor', $loan) }}" method="POST" class="row mb-3">
                @csrf
                <div class="col-md-6">
                    <span>Select existing guarantor:</span>
                    <select name="guarantor_id" class="form-control" required>
                        <option value="">Select Guarantor</option>
                        @foreach ($availableGuarantors as $guarantor)
                            <option value="{{ $guarantor->id }}">{{ $guarantor->first_name }} {{ $guarantor->last_name }} / {{ $guarantor->phone }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-2 d-flex align-items-end">
                    <button type="submit" class="btn btn-primary">Add</button>
                </div>
            </form>
        @endif
        <div class="table-responsive">
            <table class="table table-hover table-custom">
                <thead class="thead-info">
                    <tr><th>S/N</th><th>Full Name</th><th>Phone Number</th><th>Relationship</th></tr>
                </thead>
                <tbody>
                    @forelse ($loan->guarantors as $guarantor)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ trim($guarantor->first_name.' '.$guarantor->middle_name.' '.$guarantor->last_name) }}</td>
                            <td>{{ $guarantor->phone }}</td>
                            <td>{{ $guarantor->relationship }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="4" class="text-center">No data available in table</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </x-card>

    <x-card title="Collateral List">
        <form action="{{ route('loans.securities.collateral', $loan) }}" method="POST" enctype="multipart/form-data">
            @csrf
            <div class="row">
                <div class="col-lg-3 col-6">
                    <span>*Collateral Name:</span>
                    <input type="text" name="colateral_name" class="form-control" placeholder="Collateral name" required>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*Collateral type:</span>
                    <input type="text" name="colateral_type" class="form-control" placeholder="Collateral type" required>
                </div>
                <div class="col-lg-2 col-6">
                    <span>*Collateral Location:</span>
                    <input type="text" name="colateral_location" class="form-control" placeholder="Collateral Location" required>
                </div>
                <div class="col-lg-2 col-6">
                    <span>*Collateral Value:</span>
                    <input type="number" name="colateral_value" class="form-control" placeholder="Collateral Value" required>
                </div>
                <div class="col-lg-2 col-12">
                    <span>General collateral Attachment(pdf):</span>
                    <input type="file" name="attachment" accept="application/pdf" class="form-control">
                </div>
            </div>
            <div class="text-center m-t-20">
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
        <div class="table-responsive m-t-20">
            <table class="table table-hover table-custom">
                <thead class="thead-info">
                    <tr><th>S/N</th><th>Collateral Name</th><th>Collateral type</th><th>Collateral Value</th><th>Collateral Location</th><th>Action</th></tr>
                </thead>
                <tbody>
                    @forelse ($loan->collaterals as $collateral)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $collateral->name }}</td>
                            <td>{{ $collateral->type }}</td>
                            <td>{{ money($collateral->value) }}</td>
                            <td>{{ $collateral->location }}</td>
                            <td><x-action-button :action="route('loans.securities.collateral.destroy', $collateral)" method="DELETE" confirm="Are you sure?" icon="icon-trash" /></td>
                        </tr>
                    @empty
                        <tr><td colspan="6" class="text-center">No data available in table</td></tr>
                    @endforelse
                    <tr>
                        <th colspan="6">General collateral Attachment:
                            @if ($loan->collateral_attachment)
                                <a href="{{ asset('storage/'.$loan->collateral_attachment) }}" target="_blank">{{ basename($loan->collateral_attachment) }}</a>
                            @endif
                        </th>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="text-center m-t-20">
            <a href="{{ route('loans.pending') }}" class="btn btn-info">Finish <i class="icon-arrow-right"></i></a>
        </div>
    </x-card>

    <x-modal id="add-guarantor" title="Register Guarantor" :action="route('loans.securities.guarantor', $loan)" submit="Save">
        @include('customers.partials.guarantor-fields')
    </x-modal>
@endsection
