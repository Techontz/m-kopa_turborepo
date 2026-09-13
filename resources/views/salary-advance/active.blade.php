@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Salary Advance</li>
    <li class="breadcrumb-item active">salary Advance Loan</li>
@endsection

@section('content')
    <x-card title="Salary advance Loan">
        <x-slot:actions>
            <x-header-button target="addcontact2" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>Customer Name</th>
                        <th>Branch Name</th>
                        <th>Loan Amount</th>
                        <th>Interest</th>
                        <th>Principal + Interest</th>
                        <th>Paid Amount</th>
                        <th>Remain Amount</th>
                        <th>Status</th>
                        <th>charger</th>
                        <th>Date</th>
                        <th>Alert</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($advances as $advance)
                        @php
                            $startDate = $advance->approved_at ?? $advance->created_at;
                            $endDate = $startDate->copy()->addMonthNoOverflow()->day(5);
                        @endphp
                        <tr>
                            <td>{{ $advance->customer?->full_name }}</td>
                            <td>{{ $advance->branch?->name }}</td>
                            <td>{{ money($advance->amount) }}</td>
                            <td>{{ (float) $advance->interest_rate }}%</td>
                            <td>{{ money($advance->total_payable) }}</td>
                            <td>{{ money($advance->paid_amount) }}</td>
                            <td>{{ money($advance->remaining_amount) }}</td>
                            <td>ACTIVE</td>
                            <td>{{ money($advance->fee) }}</td>
                            <td>{{ $advance->created_at->format('Y-m-d H:i:s') }}</td>
                            <td>
                                @if ($endDate->isPast())
                                    <span class="badge badge-info">old</span>
                                @else
                                    <span class="badge badge-success">New</span>
                                @endif
                            </td>
                            <td class="text-nowrap">
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-info" data-toggle="modal" data-target="#addcontact1{{ $advance->id }}" title="Deposit"><i class="icon-pencil"></i></a>
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-info" data-toggle="modal" data-target="#addcontact2{{ $advance->id }}" title="Deposit History"><i class="icon-list"></i></a>
                                <x-action-button :action="route('salary-advances.destroy', $advance)" method="DELETE" confirm="Are you sure?" icon="icon-trash" class="btn btn-danger btn-sm" title="Delete" />
                            </td>
                        </tr>

                        <x-modal :id="'addcontact1'.$advance->id" :action="route('salary-advances.pay', $advance)" submit="Deposit" size="">
                            <h6 class="title">Deposit ({{ $advance->customer?->full_name }}) <br>start Date:{{ $startDate->format('Y-m-d H:i:s') }} <br> End Date: {{ $endDate->format('Y-m-d') }}</h6>
                            <div class="row clearfix">
                                <div class="col-md-12">
                                    <span>Amount:</span>
                                    <input type="number" name="amount" class="form-control" placeholder="Enter Amount" autocomplete="off" required>
                                </div>
                            </div>
                        </x-modal>

                        @include('salary-advance.partials.history-modal', ['advance' => $advance])
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL:</b></td>
                        <td></td>
                        <td><b>{{ money($advances->sum('amount')) }}</b></td>
                        <td></td>
                        <td><b>{{ money($advances->sum('total_payable')) }}</b></td>
                        <td><b>{{ money($advances->sum('paid_amount')) }}</b></td>
                        <td><b>{{ money($advances->sum('remaining_amount')) }}</b></td>
                        <td></td>
                        <td><b>{{ money($advances->sum('fee')) }}</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-date-range-filter id="addcontact2" :action="route('salary-advances.active')" :branches="$branches" branch-placeholder="select" :dates-required="false" />
@endsection
