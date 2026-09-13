@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Customer</li>
    <li class="breadcrumb-item active">Customer Registration Form</li>
@endsection

@section('content')
    @include('customers.partials.wizard-tabs', ['step' => 1, 'customer' => $customer])

    <div class="card">
        <div class="body">
            <h6>Basic Information</h6>
            <form action="{{ $customer ? route('customers.basic.update', $customer) : route('customers.store') }}" method="POST">
                @csrf
                @if ($customer)
                    @method('PUT')
                @endif
                @include('customers.partials.basic-form')
                <br>
                <div class="text-center">
                    <button type="submit" class="btn btn-info btn-sm">next <i class="icon-arrow-right"></i></button>
                </div>
            </form>
        </div>
    </div>
@endsection
