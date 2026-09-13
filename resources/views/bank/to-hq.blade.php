@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Bank</li>
    <li class="breadcrumb-item active">Transfor Balance To salary advance Acc</li>
@endsection

@section('content')
    <x-card title="Transaction list From Bank Acc to salary Advance & disbursement Account">
        <x-slot:actions>
            <x-header-button target="addcontact2" icon="icon-pencil" />
            <x-header-button target="addcontact1" />
        </x-slot:actions>
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Amount</th>
                        <th>Chargers Fee</th>
                        <th>From Account</th>
                        <th>To Account</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($transfers as $transfer)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ money($transfer->amount) }}</td>
                            <td>{{ money($transfer->charge) }}</td>
                            <td>{{ $transfer->bankAccount?->name }}</td>
                            <td>{{ $transfer->hq_account === \App\Enums\Account::HqSalaryAdvance->value ? 'SALARY ACC' : 'DISBURSEMENT ACC' }}</td>
                            <td>{{ $transfer->transfer_date->format('Y-m-d') }}</td>
                            <td></td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td>TOTAL:</td>
                        <td><b>{{ money($transfers->sum('amount')) }}</b></td>
                        <td><b>{{ money($transfers->sum('charge')) }}</b></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" title="Transaction form" :action="route('bank-transfers.to-hq.store')" submit="Submit" size="">
        <div class="row clearfix">
            <div class="col-md-6 col-6">
                <span>Account:</span>
                <select name="from_acc" class="form-control" required>
                    <option value="">Select Account</option>
                    @foreach ($bankAccounts as $bankAccount)
                        <option value="{{ $bankAccount->id }}" @selected((string) old('from_acc') === (string) $bankAccount->id)>{{ $bankAccount->name }} - {{ money($bankAccount->balance()) }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-md-6 col-6">
                <span>Amount:</span>
                <input type="number" name="amount" class="form-control" placeholder="Amount" value="{{ old('amount') }}" autocomplete="off" required>
            </div>
            <div class="col-md-6 col-6">
                <span>To Acc:</span>
                <select name="to_acc" class="form-control" required>
                    <option value="">Select</option>
                    <option value="salary" @selected(old('to_acc') === 'salary')>SALARY ACC</option>
                    <option value="disbursement" @selected(old('to_acc') === 'disbursement')>DISBURSEMENT ACC</option>
                </select>
            </div>
            <div class="col-md-6 col-6">
                <span>Charges Fee:</span>
                <input type="number" name="charger_fee" class="form-control" placeholder="Chargers Fee" value="{{ old('charger_fee') }}" autocomplete="off" required>
            </div>
        </div>
    </x-modal>

    <x-date-range-filter id="addcontact1" :action="route('bank-transfers.to-hq')" />
@endsection
