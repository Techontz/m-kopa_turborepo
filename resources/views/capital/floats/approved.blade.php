@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Float</li>
    <li class="breadcrumb-item active">Aproved Float</li>
@endsection

@section('content')
    <div class="card">
        <div class="header">
            <h2>Transaction List Aproved</h2>
            <div class="pull-right" style="position: absolute; right: 20px; top: 38px;">
                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact2"><i class="icon-magnifier"></i></a>
            </div>
        </div>
        <div class="body">
            <div class="table-responsive">
                <table class="table table-hover js-basic-example dataTable table-custom">
                    <thead class="thead-info">
                        <tr>
                            <th>S/no.</th>
                            <th>From Branch</th>
                            <th>To Branch</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($transfers as $transfer)
                            <tr>
                                <td>{{ $loop->iteration }}.</td>
                                <td>{{ $transfer->fromBranch?->name }}</td>
                                <td>{{ $transfer->toBranch?->name }}</td>
                                <td>{{ money($transfer->amount) }}</td>
                                <td><span class="badge badge-success">Aproved</span></td>
                                <td>{{ $transfer->transfer_date->format('Y-m-d') }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                    <tfoot>
                        <tr>
                            <td>TOTAL:</td>
                            <td></td>
                            <td></td>
                            <td><b>{{ money($transfers->sum('amount')) }}</b></td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>

    <x-modal id="addcontact2" title="Filter By" :action="route('floats.approved')" method="GET" submit="Filter" size="">
        <div class="row clearfix">
            <div class="col-lg-6 col-6">
                <span>*From:</span>
                <input type="date" name="from" value="{{ request('from', today()->toDateString()) }}" class="form-control" required>
            </div>
            <div class="col-lg-6 col-6">
                <span>*To:</span>
                <input type="date" name="to" value="{{ request('to', today()->toDateString()) }}" class="form-control" required>
            </div>
        </div>
    </x-modal>
@endsection
