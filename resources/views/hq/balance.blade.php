@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Headquater Account Balance</li>
@endsection

@section('content')
    <x-card title="Headquater Account Balance">
        <x-slot:actions>
            <x-header-button target="addcontact1" />
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover dataTable table-custom" data-no-datatable>
                <thead class="thead-info">
                    <tr>
                        <th>Account Name</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($balances as $label => $amount)
                        <tr>
                            <td><b>{{ $label }}</b></td>
                            <td><b>{{ money($amount) }}</b></td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL:</b></td>
                        <td><b>{{ money($balances->sum()) }}</b></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-date-range-filter id="addcontact1" :action="route('hq-transactions.balance')" />
@endsection
