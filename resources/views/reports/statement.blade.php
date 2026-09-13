@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">Customer statement</li>
@endsection

@section('content')
    <x-card title="Search Customer">
        <form action="{{ route('reports.statement') }}" method="GET">
            <div class="row">
                <div class="col-lg-2 col-12"></div>
                <div class="col-lg-4 col-6">
                    <span>Customer</span>
                    <select class="form-control select2" name="customer_id" id="customer" required
                        data-dependent-url="{{ route('lookup.customer-loans') }}" data-dependent-target="#loan" data-dependent-param="customer_id">
                        <option value="">Search Customer</option>
                        @foreach ($customers as $option)
                            <option value="{{ $option->id }}" @selected($customer?->id === $option->id)>{{ $option->full_name }} / {{ $option->customer_code }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-lg-4 col-6">
                    <span>Loan</span>
                    <select class="form-control select2" name="loan_id" id="loan" required>
                        <option value="">select loan</option>
                        @foreach ($customerLoans as $option)
                            <option value="{{ $option->id }}" @selected($loan?->id === $option->id)>{{ $option->category?->name }} / {{ money($option->amount_approved ?: $option->amount_applied) }} / {{ $option->status->label() }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-lg-2 col-12"></div>
            </div>
            <div class="text-center m-t-20">
                <button type="submit" class="btn btn-primary"><i class="icon-magnifier"></i>Search</button>
            </div>
        </form>
    </x-card>

    @if ($loan)
        <x-card title="Customer Account Statement">
            <x-slot:actions>
                <li><a href="javascript:window.print();" class="btn btn-sm btn-primary"><i class="icon-printer"></i></a></li>
            </x-slot:actions>

            <div class="table-responsive">
                <table class="table table-bordered table-sm" data-no-datatable>
                    <tbody>
                        <tr>
                            <td><b>Customer Name:</b> {{ $customer->full_name }}</td>
                            <td><b>Customer ID:</b> {{ $customer->customer_code }}</td>
                            <td><b>Phone Number:</b> {{ $customer->phone }}</td>
                            <td><b>Branch:</b> {{ $loan->branch->name }}</td>
                        </tr>
                        <tr>
                            <td><b>Loan Ac:</b> {{ $loan->loan_number }}</td>
                            <td><b>Loan Product:</b> {{ $loan->category?->name }}</td>
                            <td><b>Loan Amount:</b> {{ money($loan->amount_approved ?: $loan->amount_applied) }}</td>
                            <td><b>Principal + Interest:</b> {{ money($loan->total_payable) }}</td>
                        </tr>
                        <tr>
                            <td><b>Duration Type:</b> {{ $loan->duration->label() }} / {{ $loan->sessions }}</td>
                            <td><b>Restoration:</b> {{ money($loan->restoration) }}</td>
                            <td><b>Withdrawal Date:</b> {{ $loan->withdrawn_at?->format('Y-m-d') }}</td>
                            <td><b>End Date:</b> {{ $loan->end_date?->format('Y-m-d') }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="table-responsive">
                <table class="table table-hover js-basic-example dataTable table-custom">
                    <thead class="thead-info">
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Deposit</th>
                            <th>Withdrawal</th>
                            <th>Balance</th>
                            <th>Remain Debit</th>
                            <th>Penalty</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($rows as $row)
                            <tr>
                                <td>{{ $row['date']->format('Y-m-d') }}</td>
                                <td>{{ $row['description'] }}</td>
                                <td>{{ money($row['deposit']) }}</td>
                                <td>{{ money($row['withdrawal']) }}</td>
                                <td>{{ money($row['balance']) }}</td>
                                <td>{{ money($row['remain']) }}</td>
                                <td>{{ money($row['penalty']) }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                    <tfoot>
                        <tr>
                            <th>TOTAL</th>
                            <th></th>
                            <th>{{ money($rows->sum('deposit')) }}</th>
                            <th>{{ money($rows->sum('withdrawal')) }}</th>
                            <th></th>
                            <th></th>
                            <th></th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </x-card>
    @endif
@endsection
