@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Customer</li>
    <li class="breadcrumb-item active">Customer Registration Form</li>
@endsection

@section('content')
    @include('customers.partials.wizard-tabs', ['step' => 3, 'customer' => $customer])

    @include('customers.partials.passport-section', [
        'documentsAction' => route('customers.documents', $customer),
        'saveLabel' => 'Save',
        'backUrl' => route('customers.additional', $customer),
    ])
@endsection
