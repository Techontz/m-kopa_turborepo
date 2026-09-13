@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Customer</li>
    <li class="breadcrumb-item active">Customer Registration Form</li>
@endsection

@section('content')
    @include('customers.partials.wizard-tabs', ['step' => 2, 'customer' => $customer])

    <div class="card">
        <div class="body">
            <h6>Aditinal Detail</h6>
            <form action="{{ route('customers.additional.store', $customer) }}" method="POST">
                @csrf
                @method('PUT')
                @include('customers.partials.additional-form')
                <br>
                <div class="text-center">
                    <a href="{{ route('customers.basic', $customer) }}" class="btn btn-info btn-sm"><i class="icon-arrow-left"></i>back</a>
                    <button type="submit" class="btn btn-info btn-sm">next <i class="icon-arrow-right"></i></button>
                </div>
            </form>
        </div>
    </div>
@endsection
