@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Bank</li>
    <li class="breadcrumb-item active">Payrol</li>
@endsection

@section('content')
    <x-card title="Payrol List">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Amount</th>
                        <th>From Account</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($payrolls as $payroll)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ money($payroll->total) }}</td>
                            <td>{{ $payroll->paid_from_account }}</td>
                            <td>{{ $payroll->paid_on->format('Y-m-d') }}</td>
                            <td><a href="{{ route('payroll.show', $payroll->paid_on->format('Y-m-d')) }}" class="btn btn-primary"><i class="icon-eye"></i></a></td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td>TOTAL:</td>
                        <td><b>{{ money($payrolls->sum('total')) }}</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>
@endsection
