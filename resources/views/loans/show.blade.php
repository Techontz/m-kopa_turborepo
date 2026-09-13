@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan</li>
    <li class="breadcrumb-item active">Applied Loan</li>
@endsection

@push('styles')
    <style>
        .applied-form label { font-weight: 700; color: #444; margin-bottom: 2px; }
        .applied-form .approved label { color: green; }
        .applied-form .approved input { border-color: green; color: green; }
    </style>
@endpush

@section('content')
    @include('loans.partials.customer-header', ['customer' => $loan->customer, 'loan' => $loan])

    <x-card title="Guarantors List">
        <div class="table-responsive">
            <table class="table table-hover table-custom">
                <thead class="thead-info"><tr><th>S/N</th><th>Full Name</th><th>Phone Number</th><th>Relationship</th><th>Action</th></tr></thead>
                <tbody>
                    @forelse ($loan->guarantors as $guarantor)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ strtoupper(trim($guarantor->first_name.' '.$guarantor->middle_name.' '.$guarantor->last_name)) }}</td>
                            <td>{{ $guarantor->phone }}</td>
                            <td>{{ $guarantor->relationship }}</td>
                            <td>
                                <a href="{{ route('customers.show', $loan->customer) }}" class="btn btn-sm btn-icon btn-primary"><i class="icon-eye"></i></a>
                                <a href="{{ route('loans.agreement.print', $loan) }}" target="_blank" class="btn btn-sm btn-primary"><i class="icon-printer"></i></a>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="text-center">No data available in table</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </x-card>

    <x-card title="Collateral List">
        <div class="table-responsive">
            <table class="table table-hover table-custom">
                <thead class="thead-info"><tr><th>S/N</th><th>Collateral Name</th><th>Collateral type</th><th>Collateral Value</th><th>Collateral Location</th></tr></thead>
                <tbody>
                    @foreach ($loan->collaterals as $collateral)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $collateral->name }}</td>
                            <td>{{ $collateral->type }}</td>
                            <td>{{ money($collateral->value) }}</td>
                            <td>{{ $collateral->location }}</td>
                        </tr>
                    @endforeach
                    <tr>
                        <th colspan="5">General collateral Attachment:
                            @if ($loan->collateral_attachment)
                                <a href="{{ asset('storage/'.$loan->collateral_attachment) }}" target="_blank">{{ basename($loan->collateral_attachment) }}</a>
                            @endif
                        </th>
                    </tr>
                </tbody>
            </table>
        </div>
    </x-card>

    <x-card>
        <div class="table-responsive">
            <table class="table table-custom">
                <thead><tr><th>Remain Loan Amount</th><th>Salary Advance</th><th>Penarty Amount</th><th>Loan Fee</th><th>Total Deduction</th><th>Remain Cash</th></tr></thead>
                <tbody>
                    <tr>
                        <td>{{ money($deductions['remain_loan']) }}</td>
                        <td>{{ money($deductions['salary_advance']) }}</td>
                        <td>{{ money($deductions['penalty']) }}</td>
                        <td>{{ (int) $deductions['loan_fee'] }}</td>
                        <td>{{ money($deductions['total']) }}</td>
                        <td>{{ money($deductions['remain_cash']) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </x-card>

    <x-card title="Applied Loan Application Form">
        <form action="{{ route('loans.approve', $loan) }}" method="POST" class="applied-form" id="approve-form">
            @csrf
            <div class="row">
                <div class="col-md-4 mb-2">
                    <label>Loan category</label>
                    <input type="text" class="form-control" value="{{ $loan->category->name }} {{ (int) $loan->category->amount_from }} - {{ (int) $loan->category->amount_to }} / {{ rtrim(rtrim(number_format((float) $loan->interest_rate, 2), '0'), '.') }}%" readonly>
                </div>
                <div class="col-md-4 mb-2">
                    <label>Branch</label>
                    <input type="text" class="form-control" value="{{ $loan->branch->name }}" readonly>
                </div>
                <div class="col-md-4 mb-2">
                    <label>Loan Amount Applied</label>
                    <input type="text" class="form-control" value="{{ money($loan->amount_applied) }}" readonly>
                </div>
                <div class="col-md-3 mb-2 approved">
                    <label>Approved Loan</label>
                    <input type="number" name="loan_aprove" class="form-control" value="{{ (int) ($loan->amount_approved > 0 ? $loan->amount_approved : $loan->amount_applied) }}" @readonly($loan->status !== \App\Enums\LoanStatus::Pending) required>
                </div>
                <div class="col-md-3 mb-2">
                    <label>Restoration Type</label>
                    <input type="text" class="form-control" value="{{ $loan->duration->label() }}" readonly>
                </div>
                <div class="col-md-3 mb-2">
                    <label>Restoration Time</label>
                    <input type="number" class="form-control" value="{{ $loan->sessions }}" readonly>
                </div>
                <div class="col-md-3 mb-2">
                    <label>Instalment</label>
                    <input type="number" class="form-control" value="{{ (int) $loan->instalment }}" readonly>
                </div>
                <div class="col-md-3 mb-2">
                    <label>Purpose of Loan</label>
                    <input type="text" class="form-control" value="{{ $loan->reason }}" readonly>
                </div>
                <div class="col-md-3 mb-2">
                    <label>Loan + interest</label>
                    <input type="text" class="form-control" value="{{ money($loan->total_payable) }}" readonly>
                </div>
                <div class="col-md-3 mb-2">
                    <label>Restration</label>
                    <input type="text" class="form-control" value="{{ money($loan->restoration) }}" readonly>
                </div>
                <div class="col-md-3 mb-2">
                    <label>Insurerance</label>
                    <input type="text" name="insuare" class="form-control" value="{{ money($loan->insurance) }}" readonly>
                </div>
            </div>
            @if ($loan->status === \App\Enums\LoanStatus::Pending)
                <div class="text-center m-t-20">
                    @if ($loan->customer->kyc_status === 'approved')
                        <button type="submit" class="btn btn-primary"><i class="icon-arrow-right"></i>Aprove</button>
                    @else
                        <a href="javascript:;" onclick="return confirm('Please wait for the customer`s KYC to be Verfied!')" class="btn btn-sm btn-primary"><i class="icon-arrow-right"></i>Aprove</a>
                    @endif
                </div>
            @else
                <div class="text-center m-t-20"><span class="badge badge-{{ $loan->status->badge() }}">{{ $loan->status->label() }}</span></div>
            @endif
        </form>
        @if ($loan->status === \App\Enums\LoanStatus::Pending)
            <div class="text-center mt-2">
                <x-action-button :action="route('loans.reject', $loan)" confirm="Are you sure to reject this loan?" class="btn btn-sm btn-danger">Reject</x-action-button>
            </div>
        @endif
    </x-card>
@endsection
