@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Accepted Expenses</li>
@endsection

@section('content')
    <x-card title="Accepted Expenses List">
        <x-slot:actions>
            <x-header-button target="addcontact1" icon="icon-calendar" />
        </x-slot:actions>
        @include('expenses.partials.branch-table')
    </x-card>

    <x-date-range-filter id="addcontact1" :action="route('expenses.accepted')" :branches="$branches" />
@endsection
