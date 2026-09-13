@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">saving deposit</li>
@endsection

@section('content')
    <x-card title="Today saving Deposit">
        <x-slot:actions>
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
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($savings as $saving)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $saving->branch?->name }}</td>
                            <td>{{ $saving->customer?->full_name }}</td>
                            <td>{{ money($saving->amount) }}</td>
                            <td>{{ $saving->transaction_date->format('Y-m-d') }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL</b></td>
                        <td></td>
                        <td></td>
                        <td><b>{{ money($savings->sum('amount')) }}</b></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-date-range-filter id="addcontact1" :action="route('savings.deposits')" :branches="$branches" branch-placeholder="---Select Branch---" />
@endsection
