@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan</li>
    <li class="breadcrumb-item active">Loan Pending</li>
@endsection

@section('content')
    <x-card :title="$special ? 'Special Loan Pending List' : 'Loan Pending List'">
        @unless ($special)
            <x-slot:actions>
                <li><a href="{{ route('loans.special') }}" class="btn btn-info btn-sm">Special Loan <span class="badge badge-light bg-white text-danger">{{ $specialCount }}</span></a></li>
            </x-slot:actions>
        @endunless
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Loan AC/No</th>
                        <th>customer name</th>
                        <th>Phone Number</th>
                        <th>Branch</th>
                        <th>Loan Amount</th>
                        <th>Loan Duration</th>
                        <th>Number of repayments</th>
                        @if ($special)
                            <th>Instalment</th>
                        @endif
                        <th>Loan Status</th>
                        <th>Customer Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($loans as $loan)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $loan->loan_number }}</td>
                            <td><a href="{{ route('loans.show', $loan) }}">{{ $loan->customer->short_name }}</a></td>
                            <td>{{ $loan->customer->phone }}</td>
                            <td>{{ $loan->branch->name }}</td>
                            <td>{{ money($loan->amount_applied) }}</td>
                            <td>{{ $loan->duration->label() }}</td>
                            <td>{{ $loan->sessions }}</td>
                            @if ($special)
                                <td>{{ money($loan->instalment) }}</td>
                            @endif
                            <td><a href="javascript:;" class="badge badge-warning">PENDING</a></td>
                            <td><span class="badge badge-{{ $loan->customer->loans()->whereNotNull('withdrawn_at')->exists() ? 'info' : 'primary' }}">{{ $loan->customer->loans()->whereNotNull('withdrawn_at')->exists() ? 'OLD' : 'NEW' }}</span></td>
                            <td class="text-nowrap">
                                <a href="{{ route('loans.show', $loan) }}" class="btn btn-sm btn-primary" title="View"><i class="icon-eye"></i></a>
                                <x-action-button :action="route('loans.reject', $loan)" confirm="Are you sure to reject this loan?" class="btn btn-sm btn-warning" title="Reject" icon="icon-close" />
                                <a href="{{ route('loans.edit', $loan) }}" class="btn btn-sm btn-primary" title="Edit"><i class="icon-pencil"></i></a>
                                <x-action-button :action="route('loans.destroy', $loan)" method="DELETE" confirm="Are You Sure?" class="btn btn-sm btn-danger" title="Delete" icon="icon-trash" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
