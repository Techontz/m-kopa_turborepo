@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">Branchwise Loan Summary</li>
@endsection

@section('content')
    <x-card title="Branchwise Loan Summary">
        <x-slot:actions>
            <x-header-button target="addcontact2" />
            <li><a href="javascript:window.print();" class="btn btn-info btn-sm"><i class="icon-printer"></i></a></li>
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>Branch Name</th>
                        <th>Total Receivable</th>
                        <th>Receivable Pricipal</th>
                        <th>Receivable Intrest</th>
                        <th>Total Received</th>
                        <th>Received Pricipal</th>
                        <th>Received Interest</th>
                        <th>Total Pending</th>
                        <th>Reserve</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($rows as $row)
                        <tr>
                            <td>{{ $row['branch']->name }}</td>
                            <td>{{ money($row['receivable']) }}</td>
                            <td>{{ money($row['receivable_principal']) }}</td>
                            <td>{{ money($row['receivable_interest']) }}</td>
                            <td>{{ money($row['received']) }}</td>
                            <td>{{ money($row['received_principal']) }}</td>
                            <td>{{ money($row['received_interest']) }}</td>
                            <td>{{ money($row['pending']) }}</td>
                            <td>{{ money($row['reserve']) }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <th>TOTAL</th>
                        <th>{{ money($rows->sum('receivable')) }}</th>
                        <th>{{ money($rows->sum('receivable_principal')) }}</th>
                        <th>{{ money($rows->sum('receivable_interest')) }}</th>
                        <td><b>{{ money($rows->sum('received')) }}</b></td>
                        <th>{{ money($rows->sum('received_principal')) }}</th>
                        <th>{{ money($rows->sum('received_interest')) }}</th>
                        <th>{{ money($rows->sum('pending')) }}</th>
                        <th>{{ money($rows->sum('reserve')) }}</th>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    @include('reports.partials.date-filter', ['title' => 'Filter Transaction', 'action' => route('reports.branchwise')])
@endsection
