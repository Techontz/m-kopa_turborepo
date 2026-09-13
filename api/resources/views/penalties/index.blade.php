@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Penarty</li>
    <li class="breadcrumb-item active">Penarty List</li>
@endsection

@section('content')
    <x-card title="Penarty List">
        <x-slot:actions>
            <x-header-button target="addcontact1" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Customer Name</th>
                        <th>Branch Name</th>
                        <th>Loan Amount</th>
                        <th>Penart Amount</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($penalties as $penalty)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $penalty->customer?->full_name }}</td>
                            <td>{{ $penalty->branch?->name }}</td>
                            <td>{{ money($penalty->loan?->total_payable) }}</td>
                            <td>{{ money((float) $penalty->amount - (float) $penalty->paid_amount) }}</td>
                            <td>{{ $penalty->penalty_date->format('Y-m-d') }}</td>
                            <td class="text-nowrap">
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact2{{ $penalty->id }}" title="Pay Penarty"><i class="icon-pencil"></i></a>
                                <x-action-button :action="route('penalties.waive', $penalty)" confirm="Are you sure to Delete penalty?" icon="icon-trash" class="btn btn-sm btn-danger" />
                            </td>
                        </tr>

                        <x-modal :id="'addcontact2'.$penalty->id" title="Pay Penarty" :action="route('penalties.pay', $penalty)" submit="Pay" size="">
                            <div class="row clearfix">
                                <div class="col-md-12">
                                    <span>Amount:</span>
                                    <input type="number" name="penart_paid" class="form-control" placeholder="Enter Amount" autocomplete="off" required>
                                </div>
                            </div>
                        </x-modal>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact1" title="Filter" :action="route('penalties.index')" method="GET" submit="Filter" size="">
        <span>Select Branch:</span>
        <x-branch-select :branches="$branches" all all-label="All" :selected="request('blanch_id')" />
    </x-modal>
@endsection
