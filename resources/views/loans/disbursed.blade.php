@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan</li>
    <li class="breadcrumb-item active">Loan Disbursed</li>
@endsection

@section('content')
    <x-card title="Loan Disbursed List">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Customer Name</th>
                        <th>Branch Name</th>
                        <th>Loan Ac</th>
                        <th>Loan Disbursed</th>
                        <th>Loan Interest</th>
                        <th>Principle + Interest</th>
                        <th>Restoration Type</th>
                        <th>Number of Repayment</th>
                        <th>Restoration</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($loans as $loan)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $loan->customer->full_name }}</td>
                            <td>{{ $loan->branch->name }}</td>
                            <td><a href="javascript:;" data-toggle="modal" title="Loan Agrement" data-target="#agreementView{{ $loan->id }}">{{ $loan->loan_number }}</a></td>
                            <td>{{ money($loan->amount_approved) }}</td>
                            <td>{{ rtrim(rtrim(number_format((float) $loan->interest_rate, 2), '0'), '.') }}%</td>
                            <td>{{ money($loan->total_payable) }}</td>
                            <td>{{ $loan->duration->label() }}</td>
                            <td>{{ $loan->sessions }}</td>
                            <td>{{ money($loan->restoration) }}</td>
                            <td>{{ $loan->approved_at?->toDateString() }}</td>
                            <td class="text-nowrap">
                                @if ($loan->status === \App\Enums\LoanStatus::Disbursed)
                                    <x-action-button :action="route('loans.destroy', $loan)" method="DELETE" confirm="Are You Sure?" class="btn btn-sm btn-icon btn-danger" icon="icon-trash" />
                                @endif
                                <a href="javascript:;" data-toggle="modal" title="Loan Agrement" class="btn btn-info btn-sm" data-target="#agreementUpload{{ $loan->id }}"><i class="icon-doc"></i></a>
                                <a href="javascript:;" data-toggle="modal" title="Loan schedule" class="btn btn-primary btn-sm" data-target="#schedule{{ $loan->id }}"><i class="icon-eye"></i></a>
                                <a href="{{ route('loans.agreement.print', $loan) }}" title="Loan Agrement" target="_blank" class="btn btn-primary btn-sm"><i class="icon-printer"></i></a>
                            </td>
                        </tr>

                        <x-modal :id="'agreementUpload'.$loan->id" title="Upload Loan Agrement" :action="route('loans.agreement', $loan)" submit="Upload" files>
                            <span>Loan Agrement &amp; Salary Slip(pdf):</span>
                            <input type="file" name="attach" accept="application/pdf" class="form-control" required>
                        </x-modal>

                        <x-modal :id="'agreementView'.$loan->id" title="Loan Agrement">
                            @if ($loan->agreement_file)
                                <a href="{{ asset('storage/'.$loan->agreement_file) }}" target="_blank"><img src="{{ asset('assets/img/pdf.png') }}" style="width: 45px;" alt="PDF"> {{ basename($loan->agreement_file) }}</a>
                            @else
                                <p>No Data!!</p>
                            @endif
                        </x-modal>

                        <x-modal :id="'schedule'.$loan->id" title="Customer Loan Schedule">
                            <table class="table table-hover table-custom">
                                <thead class="thead-info"><tr><th>S/no.</th><th>Date</th><th>Description</th><th>Restoration</th><th>Received</th><th>Pending</th></tr></thead>
                                <tbody>
                                    @forelse ($loan->schedules as $schedule)
                                        @php $pending = max(0, (float) $schedule->amount - (float) $schedule->paid_amount); @endphp
                                        <tr>
                                            <td>{{ $loop->iteration }}.</td>
                                            <td>{{ $schedule->due_date->toDateString() }}</td>
                                            <td>{{ $pending <= 0 ? 'paid' : 'pending' }}</td>
                                            <td>{{ money($schedule->amount) }}</td>
                                            <td>{{ number_format((float) $schedule->paid_amount, 2) }}</td>
                                            <td>{{ number_format($pending, 2) }}</td>
                                        </tr>
                                    @empty
                                        <tr><td colspan="6" class="text-center">No Data!!</td></tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </x-modal>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
