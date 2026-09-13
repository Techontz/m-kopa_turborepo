@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">HRM</li>
    <li class="breadcrumb-item active">Salary Sheet</li>
@endsection

@section('content')
    <x-card :title="'Staff Sallary Sheet / '.now()->format('F, d, Y')">
        <x-slot:actions>
            <x-header-button target="addcontact4" icon="icon-pencil" title="pay salary" />
            <x-header-button target="addcontact3" icon="icon-list" title="sallary statement" />
            <x-header-button target="addcontact2" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Staff name</th>
                        <th>Sallary Amount</th>
                        <th>Sallary Advance</th>
                        <th>Allowance</th>
                        <th>Deduction</th>
                        <th>Loan Restration</th>
                        <th>Take Home</th>
                        <th>Phone no</th>
                        <th>Account name</th>
                        <th>Account no</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($rows as $row)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $row['employee']->full_name }}</td>
                            <td>{{ money($row['salary']) }}</td>
                            <td>{{ money($row['salary_advance']) }}</td>
                            <td>{{ money($row['allowance']) }}</td>
                            <td>{{ money($row['deduction']) }}</td>
                            <td>{{ money($row['loan_restoration']) }}</td>
                            <td>{{ money($row['take_home']) }}</td>
                            <td>{{ $row['employee']->phone }}</td>
                            <td>{{ $row['employee']->salaryInfo?->account_name }}</td>
                            <td>{{ $row['employee']->salaryInfo?->account_number }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL</b></td>
                        <td></td>
                        <td><b>{{ money($rows->sum('salary')) }}</b></td>
                        <td><b>{{ money($rows->sum('salary_advance')) }}</b></td>
                        <td><b>{{ money($rows->sum('allowance')) }}</b></td>
                        <td><b>{{ money($rows->sum('deduction')) }}</b></td>
                        <td><b>{{ money($rows->sum('loan_restoration')) }}</b></td>
                        <td><b>{{ money($rows->sum('take_home')) }}</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact4" title="Pay Sallary" :action="route('salary-sheet.pay')" submit="Pay" size="">
        <span>Account:</span>
        <select name="ac_id" class="form-control" required>
            <option value="{{ \App\Enums\Account::Interest->value }}">INTEREST ACC</option>
        </select>
    </x-modal>

    <x-modal id="addcontact3" title="Sallary Paid">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Staff name</th>
                        <th>Sallary Amount</th>
                        <th>Sallary Advance</th>
                        <th>Allowance</th>
                        <th>Deduction</th>
                        <th>Loan Restration</th>
                        <th>Take Home</th>
                        <th>Phone no</th>
                        <th>Account name</th>
                        <th>Account no</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($payments as $payment)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $payment->employee?->full_name }}</td>
                            <td>{{ money($payment->salary) }}</td>
                            <td>{{ money($payment->salary_advance) }}</td>
                            <td>{{ money($payment->allowance) }}</td>
                            <td>{{ money($payment->deduction) }}</td>
                            <td>{{ money($payment->loan_restoration) }}</td>
                            <td>{{ money($payment->take_home) }}</td>
                            <td>{{ $payment->phone }}</td>
                            <td>{{ $payment->account_name }}</td>
                            <td>{{ $payment->account_number }}</td>
                            <td>{{ $payment->paid_on->format('Y-m-d') }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-modal>

    <x-date-range-filter id="addcontact2" :action="route('salary-sheet.index')" />

    @if (request()->filled('from'))
        @push('scripts')
            <script>
                $(function () { $('#addcontact3').modal('show'); });
            </script>
        @endpush
    @endif
@endsection
