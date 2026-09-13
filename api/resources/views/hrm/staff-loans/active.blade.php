@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">HRM</li>
    <li class="breadcrumb-item active">Staff Loan</li>
@endsection

@section('content')
    <x-card title="Staff Active Loan">
        <x-slot:actions>
            <li><a href="{{ route('staff-loans.index') }}" class="btn btn-primary btn-sm" title="back"><i class="icon-arrow-left"></i></a></li>
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Branch</th>
                        <th>Staff name</th>
                        <th>How loan</th>
                        <th>Loan Aproved</th>
                        <th>No.Repayment</th>
                        <th>Loan + interest</th>
                        <th>Paid Amount</th>
                        <th>Remain Amount</th>
                        <th>Status</th>
                        <th>chargers</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($loans as $loan)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $loan->branch->name }}</td>
                            <td>{{ $loan->employee->first_name }}</td>
                            <td>{{ money($loan->amount_applied) }}</td>
                            <td>{{ money($loan->amount_approved) }}</td>
                            <td>{{ ucfirst($loan->duration) }} / {{ $loan->sessions }}</td>
                            <td>{{ money($loan->total_payable) }}</td>
                            <td>{{ money($loan->paidAmount()) }}</td>
                            <td>{{ money($loan->remainingAmount()) }}</td>
                            <td><span class="badge badge-success">{{ $loan->status }}</span></td>
                            <td>{{ money($loan->fee) }}</td>
                            <td>{{ $loan->created_at->format('Y-m-d H:i:s') }}</td>
                            <td class="text-nowrap">
                                <a href="javascript:;" data-toggle="modal" data-target="#addcontact3{{ $loan->id }}" class="btn btn-sm btn-primary"><i class="icon-pencil"></i></a>
                                <a href="javascript:;" data-toggle="modal" data-target="#addcontact4{{ $loan->id }}" class="btn btn-sm btn-primary"><i class="icon-list"></i></a>
                            </td>
                        </tr>

                        <x-modal :id="'addcontact3'.$loan->id" title="Pay loan" :action="route('staff-loans.pay', $loan)" submit="Deposit" size="">
                            <div class="row clearfix">
                                <div class="col-md-12 col-12">
                                    <span>Amount</span>
                                    <input type="number" class="form-control" placeholder="Enter Amount" name="amount" max="{{ $loan->remainingAmount() }}" required>
                                </div>
                            </div>
                        </x-modal>

                        <x-modal :id="'addcontact4'.$loan->id" title="Loan Payments" size="">
                            <table class="table table-hover table-custom" data-no-datatable>
                                <thead class="thead-info">
                                    <tr>
                                        <th>S/No.</th>
                                        <th>Amount</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($loan->payments as $payment)
                                        <tr>
                                            <td>{{ $loop->iteration }}.</td>
                                            <td>{{ money($payment->amount) }}</td>
                                            <td>{{ $payment->paid_on->format('Y-m-d') }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </x-modal>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td>TOTAL</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td>{{ money($loans->sum('amount_approved')) }}</td>
                        <td></td>
                        <td>{{ money($loans->sum('total_payable')) }}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td>{{ money($loans->sum('fee')) }}</td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>
@endsection
