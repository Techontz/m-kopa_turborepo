@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Bank</li>
    <li class="breadcrumb-item active">Bank Balance</li>
@endsection

@section('content')
    <x-card title="Account Balance">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Account Name</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($accounts as $account)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $account->name }}</td>
                            <td>{{ money($balances[$account->id]) }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL</b></td>
                        <td></td>
                        <td><b>{{ money($balances->sum()) }}</b></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>
@endsection
