@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan Fee</li>
@endsection

@section('content')
    <div class="card">
        <div class="header">
            <h2>Loan Fee</h2>
            <div class="pull-right" style="position: absolute; right: 20px; top: 38px;">
                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact1"><i class="icon-magnifier"></i></a>
            </div>
        </div>
        <div class="body">
            <div class="table-responsive">
                <table class="table table-hover js-basic-example dataTable table-custom">
                    <thead class="thead-info">
                        <tr>
                            <th>S/NO.</th>
                            <th>Customer Name</th>
                            <th>Branch Name</th>
                            <th>Loan Aproved</th>
                            <th>Income Amount</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($entries as $entry)
                            <tr>
                                <td>{{ $loop->iteration }}.</td>
                                <td>{{ $entry->reference?->customer?->full_name }}</td>
                                <td>{{ $entry->branch?->name }}</td>
                                <td>{{ money($entry->reference?->amount_approved) }}</td>
                                <td>{{ money($entry->amount) }}</td>
                                <td>{{ $entry->entry_date->format('Y-m-d') }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><b>TOTAL</b></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td><b>{{ money($total) }}</b></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>

    <x-modal id="addcontact1" title="Filter Loan Fee" :action="route('loan-fees.income')" method="GET" submit="Filter" size="">
        <div class="row clearfix">
            <div class="col-md-12">
                <span>Select Branch:</span>
                <x-branch-select :branches="$branches" placeholder="---Select Branch---" all :selected="request('blanch_id')" />
            </div>
            <div class="col-md-6">
                <span>From:</span>
                <input type="date" class="form-control" value="{{ request('from', today()->toDateString()) }}" name="from" required>
            </div>
            <div class="col-md-6">
                <span>To:</span>
                <input type="date" class="form-control" name="to" value="{{ request('to', today()->toDateString()) }}" required>
            </div>
        </div>
    </x-modal>
@endsection
