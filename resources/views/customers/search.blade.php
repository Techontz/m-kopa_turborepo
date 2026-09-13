@extends('layouts.app')

@section('breadcrumb')
    @foreach ($breadcrumbs ?? ['customer', 'Search customer'] as $crumb)
        <li class="breadcrumb-item active">{{ $crumb }}</li>
    @endforeach
@endsection

@section('content')
    <div class="row clearfix">
        <div class="col-lg-12">
            <x-card title="Search Customer">
                <div class="row">
                    <div class="col-md-6">
                        <select class="form-control select2 js-location-select">
                            <option value="">{{ $placeholder ?? 'Select customer' }}</option>
                            @foreach ($customers as $customer)
                                <option value="{{ route($targetRoute ?? 'customers.show', $customer) }}">{{ $customer->full_name }}{{ ($showCode ?? false) ? ' / '.$customer->customer_code : '' }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
            </x-card>
        </div>
    </div>
@endsection
