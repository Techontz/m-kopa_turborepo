@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Aprove</li>
    <li class="breadcrumb-item active">Aprove Section</li>
@endsection

@section('content')
    <div class="card">
        <div class="body">
            <ul class="nav nav-tabs-new profile-tabs">
                <li class="nav-item"><a class="nav-link" href="{{ route('expenses.approve-section') }}">Expensess <span class="badge badge-danger">{{ $expenseRequests->count() }}</span></a></li>
                <li class="nav-item"><a class="nav-link" href="{{ route('floats.branch') }}">Float Transaction <span class="badge badge-danger">{{ $pendingFloats }}</span></a></li>
                <li class="nav-item"><a class="nav-link" href="{{ route('bank-transfers.index') }}">Bank <span class="badge badge-danger">{{ $pendingBank }}</span></a></li>
                <li class="nav-item"><a class="nav-link" href="{{ route('dashboard') }}">Back</a></li>
            </ul>
        </div>
    </div>

    <div class="card">
        <div class="body">
            <h6>Expenses</h6>
            @include('expenses.partials.branch-table')
        </div>
    </div>
@endsection
