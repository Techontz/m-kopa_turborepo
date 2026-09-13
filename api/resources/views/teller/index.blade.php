@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Teller</li>
    <li class="breadcrumb-item active">Teller Dashboard</li>
@endsection

@section('content')
    <div class="row clearfix">
        <div class="col-lg-12">
            <x-card title="Search Customer">
                <div class="row">
                    <div class="col-md-6">
                        <select class="form-control select2 js-location-select" required>
                            <option value="">Search Customer</option>
                            @foreach ($customers as $customer)
                                <option value="{{ route('teller.show', $customer) }}">{{ $customer->full_name }} / {{ $customer->customer_code }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
            </x-card>
        </div>
    </div>
@endsection
