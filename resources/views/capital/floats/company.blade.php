@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Transifor Float From Company Account To Blanch Account</li>
@endsection

@section('content')
    <x-card title="Transifor Float Form">
        <form action="{{ route('floats.company.store') }}" method="POST">
            @csrf
            <div class="row">
                <div class="col-md-6">
                    <span>*Amount:</span>
                    <input type="number" required class="form-control" placeholder="Amount" name="blanch_amount" value="{{ old('blanch_amount') }}">
                </div>
                <div class="col-md-6">
                    <span>*To Branch Name:</span>
                    <x-branch-select :branches="$branches" placeholder="---Select Branch---" class="form-control select2" />
                </div>
            </div>
            <br>
            <div class="text-center">
                <button type="submit" class="btn btn-primary"><i class="icon-pencil"></i>Transfor</button>
            </div>
        </form>
    </x-card>

    <div class="card">
        <div class="header">
            <h2>Today Transaction</h2>
            <div class="pull-right" style="position: absolute; right: 20px; top: 38px;">
                <a href="javascript:;" class="btn btn-primary btn-sm" data-toggle="modal" data-target="#addcontact1"><i class="icon-calendar"></i>Previous</a>
            </div>
        </div>
        <div class="body">
            <div class="table-responsive">
                <table class="table table-hover js-basic-example dataTable table-custom">
                    <thead class="thead-info">
                        <tr>
                            <th>Branch</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($transfers as $transfer)
                            <tr>
                                <td>{{ $transfer->toBranch?->name }}</td>
                                <td>{{ money($transfer->amount) }}</td>
                                <td>{{ $transfer->transfer_date->format('Y-m-d') }}</td>
                                <td></td>
                            </tr>
                        @endforeach
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><b>TOTAL</b></td>
                            <td><b>{{ money($transfers->sum('amount')) }}</b></td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>

    <x-modal id="addcontact1" title="Filter Transaction by" :action="route('floats.company')" method="GET" submit="Filter" size="">
        <div class="row clearfix">
            <div class="col-md-12">
                <span>Select Branch</span>
                <x-branch-select :branches="$branches" placeholder="---Select Branch---" :selected="request('blanch_id')" />
            </div>
            <div class="col-md-6">
                <span>From</span>
                <input type="date" class="form-control" autocomplete="off" name="from" value="{{ request('from', today()->toDateString()) }}" required>
            </div>
            <div class="col-md-6">
                <span>To</span>
                <input type="date" class="form-control" autocomplete="off" name="to" value="{{ request('to', today()->toDateString()) }}" required>
            </div>
        </div>
    </x-modal>
@endsection
