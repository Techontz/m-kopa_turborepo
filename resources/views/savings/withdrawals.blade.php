@extends('layouts.app')

@push('styles')
    <style>
        .saving-tabs > li { flex: 0 0 auto; }
        .saving-tabs > li > a { margin-right: 0; font-family: inherit; }
        .saving-tabs > li > a.active { background: transparent; color: var(--mf-muted); }
    </style>
@endpush

@section('breadcrumb')
    <li class="breadcrumb-item active">Saving Deposit</li>
    <li class="breadcrumb-item active">Saving withdrawal</li>
@endsection

@section('content')
    <div class="card">
        <div class="body">
            <ul class="nav nav-tabs-new saving-tabs">
                <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#Basic">All</a></li>
                <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#aditinal">Saving Taken</a></li>
                <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#Account">Saving clear loan</a></li>
            </ul>
        </div>
    </div>

    <div class="tab-content padding-0">
        <div class="tab-pane active" id="Basic">
            <div class="card">
                <div class="body">
                    <h6>All Saving withdrawal</h6>
                    <div class="text-right">
                        <a href="javascript:;" data-toggle="modal" data-target="#addcontact2" class="btn btn-sm btn-primary"><i class="icon-magnifier"></i></a>
                    </div>
                    @include('savings.partials.withdrawal-table', ['rows' => $withdrawals, 'withAction' => true])
                </div>
            </div>
        </div>
        <div class="tab-pane" id="aditinal">
            <div class="card">
                <div class="body">
                    <h6>Customer Taken</h6>
                    @include('savings.partials.withdrawal-table', ['rows' => $taken, 'withAction' => true])
                </div>
            </div>
        </div>
        <div class="tab-pane" id="Account">
            <div class="card">
                <div class="header">
                    <h2>Clear Loan</h2>
                </div>
                <div class="body">
                    @include('savings.partials.withdrawal-table', ['rows' => $clearLoan, 'withAction' => false])
                </div>
            </div>
        </div>
    </div>

    <x-date-range-filter id="addcontact2" :action="route('savings.withdrawals')" :branches="$branches" />
@endsection
