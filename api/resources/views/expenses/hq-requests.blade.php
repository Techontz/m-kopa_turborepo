@extends('layouts.app')

@php
    $heading = $approved ? 'Headquater Aproved Expenses' : 'Headquater Recomended Expenses';
@endphp

@section('breadcrumb')
    <li class="breadcrumb-item active">{{ $heading }}</li>
@endsection

@section('content')
    <x-card :title="$heading">
        <x-slot:actions>
            @if ($approved)
                <x-header-button target="addcontact1" />
            @else
                <x-header-button target="addcontact1" icon="icon-pencil" />
            @endif
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Expenses</th>
                        <th>Amount</th>
                        <th>Description</th>
                        <th>Staff</th>
                        <th>status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($expenseRequests as $expenseRequest)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $expenseRequest->expenseType?->name }}</td>
                            <td>{{ money($expenseRequest->amount) }}</td>
                            <td>{{ $expenseRequest->description }}</td>
                            <td>{{ $expenseRequest->employee?->full_name }}</td>
                            <td>
                                @if ($expenseRequest->status === 'accepted')
                                    <span class="badge badge-success">Aproved</span>
                                @else
                                    <span class="badge badge-danger">Not Aproved</span>
                                @endif
                            </td>
                            <td>{{ $expenseRequest->request_date->format('Y-m-d') }}</td>
                            <td class="text-nowrap">
                                @if ($expenseRequest->status === 'pending')
                                    <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#acceptExpense{{ $expenseRequest->id }}" title="Accept"><i class="icon-pencil"></i></a>
                                    <x-action-button :action="route('expense-requests.destroy', $expenseRequest)" method="DELETE" confirm="Are You Sure?" icon="icon-trash" title="Reject" />
                                    @include('expenses.partials.accept-modal')
                                @endif
                            </td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL:</b></td>
                        <td></td>
                        <td><b>{{ money($expenseRequests->sum('amount')) }}</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    @if ($approved)
        <x-date-range-filter id="addcontact1" :action="route('hq-expenses.approved')" />
    @else
        <x-modal id="addcontact1" title="Request Expenses" :action="route('expense-requests.store')" submit="Request" size="">
            <input type="hidden" name="scope" value="hq">
            <div class="row clearfix">
                <div class="col-lg-6 col-6">
                    <div class="form-group">
                        <span>Select Expenses:</span>
                        <select name="ex_id" class="form-control" required>
                            <option value="">Select Expenses</option>
                            @foreach ($expenseTypes as $expenseType)
                                <option value="{{ $expenseType->id }}">{{ $expenseType->name }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
                <div class="col-lg-6 col-6">
                    <div class="form-group">
                        <span>Amount:</span>
                        <input type="number" name="req_amount" class="form-control" placeholder="Amount" autocomplete="off" required>
                    </div>
                </div>
                <div class="col-lg-12 col-12">
                    <div class="form-group">
                        <span>Description:</span>
                        <textarea name="req_description" class="form-control" rows="4" placeholder="Description" autocomplete="off" required></textarea>
                    </div>
                </div>
            </div>
        </x-modal>
    @endif
@endsection
