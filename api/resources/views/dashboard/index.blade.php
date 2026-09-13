@extends('layouts.app')

@section('body_class', 'theme-orange font-ubuntu')

@section('breadcrumb')
    <li class="breadcrumb-item active">Dashboard</li>
@endsection

@section('header_right')
    @foreach ($headerAccounts as $label => $amount)
        <div class="bh_chart d-none d-sm-inline-block">
            <div class="float-left m-r-15">
                <small>{{ $label }}</small>
                <h6 class="mb-0 mt-1"><i class="icon-wallet"></i> {{ money($amount) }}</h6>
            </div>
        </div>
    @endforeach
@endsection

@php
    $tiles = [
        ['customers.create', 'user.png', 'Register customer'],
        ['loans.application', 'request.jpg', 'Loan Application'],
        ['teller.index', 'teller.jpg', 'Teller'],
        ['reports.receivable', 'receivable.png', 'Receivable'],
        ['reports.received', 'received.png', 'Received'],
        ['expenses.requests', 'expenses.png', 'Expenses'],
        ['salary-advances.active', 'debits.png', 'Salary advance'],
        ['reports.pending', 'default.jpeg', 'Loan Pending'],
        ['reports.default', 'rejected.png', 'Default Loan'],
        ['loans.pending', 'aplication.png', 'Loan Request'],
        ['loans.disbursed', 'aproveds.jpg', 'Loan Aproved'],
        ['penalties.index', 'penarty.png', 'Penarty'],
        ['loans.rejected', 'rejected.jpg', 'Loan Rejected'],
        ['expenses.approve-section', 'aprove.png', 'Aprove'],
        ['reports.cash', 'transaction.png', 'Cash Transaction'],
        ['loans.withdrawal', 'withdrawal.png', 'Loan Withdrawal'],
        ['loan-fees.income', 'fee.png', 'Loan fee'],
        ['reports.daily', 'daily.png', 'Daily Report'],
    ];
@endphp

@section('content')
    <div class="row clearfix">
        <div class="col-lg-12 col-md-12">
            <x-card>
                <x-slot:actions>
                    <li><a href="javascript:;" data-toggle="modal" data-target="#addcontact4" class="btn btn-info btn-sm"><i class="icon-list"></i>Branch</a></li>
                </x-slot:actions>
                <div class="row clearfix">
                    <div class="col-md-3">
                        <a href="javascript:;" data-toggle="modal" data-target="#addcontact2">
                            <div class="body dashboard-stat bg-success text-light">
                                <h4><i class="icon-wallet"></i> {{ money($cards['account_balance']) }}</h4>
                                <span>Account Balance</span>
                            </div>
                        </a>
                    </div>
                    <div class="col-md-3">
                        <div class="body dashboard-stat bg-warning text-light">
                            <h4><i class="icon-wallet"></i> {{ money($cards['loan_withdrawal']) }}</h4>
                            <span>Loan Withdrawal</span>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="body dashboard-stat bg-primary text-light">
                            <h4><i class="icon-wallet"></i> {{ money($cards['receivable']) }}</h4>
                            <span>Expectation Receivable</span>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="body dashboard-stat bg-danger text-light">
                            <h4><i class="icon-wallet"></i> {{ money($cards['default_loan']) }}</h4>
                            <span>Default Loan</span>
                        </div>
                    </div>
                </div>
            </x-card>
        </div>
    </div>

    <div class="row clearfix">
        <div class="col-md-12 col-12">
            <x-card>
                <div class="table-responsive">
                    <table class="table table-bordered table-custom">
                        <tbody>
                            <tr style="background-color: #dddddd">
                                <th class="c">Customer Type</th>
                                <th class="c">Today Deposit</th>
                                <th class="c">Today withdrawal</th>
                                <th class="c">Today Income</th>
                                <th class="c">Today Expenses</th>
                            </tr>
                            <tr>
                                <td>Monthly customer <span class="badge badge-success">{{ $today['monthly_customers'] }}</span></td>
                                <td>Monthly Deposit <span class="badge badge-success">{{ money($today['monthly_deposit']) }}</span></td>
                                <td>Monthly Withdrawal <span class="badge badge-success">{{ money($today['monthly_withdrawal']) }}</span></td>
                                <td>Penarty <span class="badge badge-success">{{ money($today['penalty_income']) }}</span></td>
                                <td>Today Expenses <span class="badge badge-success">{{ money($today['expenses']) }}</span></td>
                            </tr>
                            <tr>
                                <td>Weekly customer <span class="badge badge-success">{{ $today['weekly_customers'] }}</span></td>
                                <td>Weekly Deposit <span class="badge badge-success">{{ money($today['weekly_deposit']) }}</span></td>
                                <td>Weekly Withdrawal <span class="badge badge-success">{{ money($today['weekly_withdrawal']) }}</span></td>
                                <td>Loan fee <span class="badge badge-success">{{ money($today['loan_fee_income']) }}</span></td>
                                <td>Bank <span class="badge badge-success">{{ money($today['bank_expenses']) }}</span></td>
                            </tr>
                            <tr>
                                <td>Daily customer <span class="badge badge-success">{{ $today['daily_customers'] }}</span></td>
                                <td>Daily Deposit <span class="badge badge-success">{{ money($today['daily_deposit']) }}</span></td>
                                <td>Daily Withdrawal <span class="badge badge-success">{{ money($today['daily_withdrawal']) }}</span></td>
                                <td>Capital<span class="badge badge-success">{{ money($today['capital_income']) }}</span></td>
                                <td>Transfer <span class="badge badge-success">{{ money($today['transfer_expenses']) }}</span></td>
                            </tr>
                            <tr>
                                <td>Groups <span class="badge badge-success">{{ $today['groups'] }}</span></td>
                                <td>Salary advance <span class="badge badge-success">{{ money($today['salary_advance_deposit']) }}</span></td>
                                <td>Salary advance <span class="badge badge-success">{{ money($today['salary_advance_withdrawal']) }}</span></td>
                                <td>Transfer <span class="badge badge-success">{{ money($today['transfer_income']) }}</span></td>
                                <td>-</td>
                            </tr>
                            <tr>
                                <td>-</td>
                                <td>Agent <span class="badge badge-success">{{ money($today['agent_deposit']) }}</span></td>
                                <td>-</td>
                                <td>Insurelance<span class="badge badge-success">{{ money($today['insurance_income']) }}</span></td>
                                <td>Saving withdrawal <span class="badge badge-success">{{ money($today['saving_withdrawal']) }}</span></td>
                            </tr>
                            <tr style="background-color: #ddddd4">
                                <th>All customer: {{ $today['all_customers'] }}</th>
                                <th>Total: {{ money($today['total_deposit']) }}</th>
                                <th>Total: {{ money($today['total_withdrawal']) }}</th>
                                <th>Total : {{ money($today['total_income']) }}</th>
                                <th>Total: {{ money($today['total_expenses']) }}</th>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </x-card>
        </div>
    </div>

    <div class="row clearfix w_social3">
        @foreach ($tiles as [$route, $image, $label])
            <div class="col-lg-2 col-md-4 col-6">
                <a href="{{ route($route) }}">
                    <div class="card">
                        <div class="icon"><img src="{{ asset('assets/img/'.$image) }}" style="width: 44px; height: 44px;" alt=""></div>
                        <div class="content">
                            <div class="text">{{ $label }}</div>
                        </div>
                    </div>
                </a>
            </div>
        @endforeach
    </div>

    <div class="row clearfix">
        <div class="col-md-12">
            <x-card>
                <div class="table-responsive">
                    <table class="table table-hover table-striped table-custom">
                        <thead>
                            <tr>
                                <th class="c">Customer Type</th>
                                <th class="c">All customer</th>
                                <th class="c">Active</th>
                                <th class="c">Pending</th>
                                <th class="c">Close</th>
                                <th class="c">Default</th>
                                <th class="c">Male</th>
                                <th class="c">Female</th>
                                <th class="c">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($customerTypes as $row)
                                <tr @if ($loop->last) style="font-weight: 700;" @endif>
                                    <td>{{ $row['label'] }}</td>
                                    <td>{{ $row['all'] }}</td>
                                    <td>{{ $row['active'] }}</td>
                                    <td>{{ $row['pending'] }}</td>
                                    <td>{{ $row['close'] }}</td>
                                    <td>{{ $row['default'] }}</td>
                                    <td>{{ $row['male'] }}</td>
                                    <td>{{ $row['female'] }}</td>
                                    <td><a href="{{ route($row['route']) }}" class="btn btn-sm btn-primary"><i class="icon-eye"></i></a></td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </x-card>
        </div>
    </div>

    <x-modal id="addcontact2" title="Company Account List">
        <table class="table table-bordered">
            <thead class="thead-info"><tr><th>A/c Name</th><th>Amount</th></tr></thead>
            <tbody>
                @foreach ($accountBalances as $name => $amount)
                    <tr><td>{{ $name }}</td><td>{{ money($amount) }}</td></tr>
                @endforeach
                <tr><th>TOTAL:</th><th>{{ money(array_sum($accountBalances)) }}</th></tr>
            </tbody>
        </table>
    </x-modal>

    <x-modal id="addcontact4" title="Branch List" size="modal-xl">
        <div class="table-responsive">
            <table class="table table-bordered">
                <thead class="thead-info">
                    <tr><th>Branch Name</th><th>Pricipal A/c</th><th>Interest A/c</th><th>Loan fee A/c</th><th>Penarty A/c</th><th>Reserve A/c</th><th>Agent</th><th>Insurance</th></tr>
                </thead>
                <tbody>
                    @foreach ($branchAccounts as $branch)
                        <tr>
                            <td>{{ $branch['name'] }}</td>
                            <td>{{ money($branch['principal']) }}</td>
                            <td>{{ money($branch['interest']) }}</td>
                            <td>{{ money($branch['loan_fee']) }}</td>
                            <td>{{ money($branch['penalty']) }}</td>
                            <td>{{ money($branch['reserve']) }}</td>
                            <td>{{ money($branch['agent']) }}</td>
                            <td>{{ money($branch['insurance']) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-modal>
@endsection
