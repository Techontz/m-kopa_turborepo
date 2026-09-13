@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Bank</li>
    <li class="breadcrumb-item active">Bank Transaction list</li>
@endsection

@section('content')
    <x-card title="Transaction Aproved list">
        <x-slot:actions>
            <x-header-button target="addcontact2" />
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>From Branch</th>
                        <th>From A/c</th>
                        <th>Amount</th>
                        <th>To A/C</th>
                        <th>status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($transfers as $transfer)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $transfer->branch?->name }}</td>
                            <td>{{ \App\Enums\Account::tryFrom((string) $transfer->branch_account)?->label() }}</td>
                            <td>{{ money($transfer->amount) }}</td>
                            <td>{{ $transfer->bankAccount?->name }}</td>
                            <td><span class="badge badge-success">Aproved</span></td>
                            <td>{{ $transfer->transfer_date->format('Y-m-d') }}</td>
                            <td></td>
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
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-date-range-filter id="addcontact2" :action="route('bank-transfers.approved')" :branches="$branches" />
@endsection
