@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">saving deposit</li>
    <li class="breadcrumb-item active">saving balance</li>
@endsection

@section('content')
    <x-card title="Saving Deposit balance">
        <x-slot:actions>
            <x-header-button target="addcontact2" icon="icon-wallet" />
            <x-header-button target="addcontact1" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Branch</th>
                        <th>customer</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($balances as $row)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $row->branch?->name }}</td>
                            <td><a href="{{ route('savings.show', $row->customer_id) }}">{{ $row->customer?->full_name }}</a></td>
                            <td>{{ money($row->balance) }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL</b></td>
                        <td></td>
                        <td></td>
                        <td><b>{{ money($balances->sum('balance')) }}</b></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact1" title="Filter" :action="route('savings.balance')" method="GET" submit="Filter" size="">
        <span>Select Branch</span>
        <x-branch-select :branches="$branches" placeholder="---Select Branch---" all :selected="request('blanch_id')" />
    </x-modal>

    <x-modal id="addcontact2" title="Saving Deposit Balance">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Branch</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($branchBalances as $branchBalance)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $branchBalance['branch']->name }}</td>
                            <td>{{ money($branchBalance['amount']) }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL:</b></td>
                        <td></td>
                        <td><b>{{ money($branchBalances->sum('amount')) }}</b></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-modal>
@endsection
