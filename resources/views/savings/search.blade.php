@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Saving Deposit</li>
    <li class="breadcrumb-item active">Search customer</li>
@endsection

@section('content')
    <x-card title="Search Customer">
        <div class="row">
            <div class="col-lg-4 col-12"></div>
            <div class="col-lg-4 col-12">
                <select class="form-control select2 js-location-select">
                    <option value="">Select customer</option>
                    @foreach ($customers as $customer)
                        <option value="{{ route('savings.show', $customer) }}">{{ $customer->full_name }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-lg-4 col-12"></div>
        </div>
    </x-card>
@endsection
