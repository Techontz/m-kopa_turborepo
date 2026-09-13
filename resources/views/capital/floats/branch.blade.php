@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Float</li>
    <li class="breadcrumb-item active">Branch To Branch</li>
@endsection

@section('content')
    <div class="card">
        <div class="header">
            <h2>Transaction List</h2>
            <div class="pull-right" style="position: absolute; right: 20px; top: 38px;">
                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact2"><i class="icon-plus"></i></a>
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
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($transfers as $transfer)
                            <tr>
                                <td>{{ $loop->iteration }}.</td>
                                <td>{{ $transfer->fromBranch?->name }}</td>
                                <td>{{ $transfer->toBranch?->name }}</td>
                                <td>{{ money($transfer->amount) }}</td>
                                <td><span class="badge badge-danger">Pending</span></td>
                                <td>{{ $transfer->transfer_date->format('Y-m-d') }}</td>
                                <td class="text-nowrap">
                                    <x-action-button :action="route('floats.approve', $transfer)" confirm="Are you sure?" class="btn btn-success btn-sm" icon="icon-check" title="Aprove" />
                                    <x-action-button :action="route('floats.destroy', $transfer)" method="DELETE" confirm="Are you sure?" class="btn btn-danger btn-sm" icon="icon-trash" />
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <x-modal id="addcontact2" title="Transfar float" :action="route('floats.branch.store')" submit="Transfar" size="">
        <div class="row clearfix">
            <div class="col-lg-6">
                <label class="form-control-label">From branch:</label>
                <x-branch-select :branches="$branches" name="from_blanch_id" />
            </div>
            <div class="col-lg-6">
                <label class="form-control-label">*To branch:</label>
                <x-branch-select :branches="$branches" name="to_blanch_id" />
            </div>
            <div class="col-lg-12">
                <label class="form-control-label">*Amount:</label>
                <input type="number" placeholder="Enter Amount" name="trans_amount" class="form-control" value="{{ old('trans_amount') }}" required>
            </div>
        </div>
    </x-modal>
@endsection
