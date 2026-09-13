@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Group</li>
    <li class="breadcrumb-item active">customer Group</li>
@endsection

@section('content')
    <x-card :title="'Customer List / '.$group->name">
        <x-slot:actions>
            <x-header-button target="addcontact1" />
            <li><a href="{{ route('groups.index') }}" class="btn btn-primary btn-sm"><i class="icon-arrow-left"></i></a></li>
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/NO.</th>
                        <th>Branch</th>
                        <th>Customer Name</th>
                        <th>Phone number</th>
                        <th>Gender</th>
                        <th>Total loan</th>
                        <th>Paid amount</th>
                        <th>Remain</th>
                        <th>Restration</th>
                        <th>Wright-off</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($loans as $loan)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ strtoupper($loan->branch?->name) }}</td>
                            <td>{{ $loan->customer?->full_name }}</td>
                            <td>{{ $loan->customer?->phone }}</td>
                            <td>{{ $loan->customer?->gender }}</td>
                            <td>{{ money($loan->total_payable) }}</td>
                            <td>{{ money($loan->deposits_sum) }}</td>
                            <td>{{ money(max(0, (float) $loan->total_payable - (float) $loan->deposits_sum)) }}</td>
                            <td>{{ money($loan->restoration) }}</td>
                            <td>{{ money($loan->writeOff?->amount) }}</td>
                            <td><span class="badge badge-{{ $loan->status->badge() }}">{{ $loan->status->label() }}</span></td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL:</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td><b>{{ money($loans->sum('total_payable')) }}</b></td>
                        <td><b>{{ money($loans->sum('deposits_sum')) }}</b></td>
                        <td><b>{{ money($loans->sum(fn ($loan) => max(0, (float) $loan->total_payable - (float) $loan->deposits_sum))) }}</b></td>
                        <td></td>
                        <td><b>{{ money($loans->sum(fn ($loan) => (float) $loan->writeOff?->amount)) }}</b></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact1" title="Filter" :action="route('groups.show', $group)" method="GET" submit="Filter" size="">
        <span>Branch</span>
        <x-branch-select :branches="$branches" all :selected="request('blanch_id')" />
    </x-modal>
@endsection
