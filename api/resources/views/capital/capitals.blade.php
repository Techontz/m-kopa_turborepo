@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Capital</li>
@endsection

@section('content')
    <x-card title="Add Capital">
        <form action="{{ route('capitals.store') }}" method="POST">
            @csrf
            <div class="row">
                <div class="col-lg-4">
                    <span>* Share Holder Name:</span>
                    <select name="share_id" class="form-control input-sm" required>
                        <option value="">Select Share Holder</option>
                        @foreach ($shareHolders as $shareHolder)
                            <option value="{{ $shareHolder->id }}" @selected((string) old('share_id') === (string) $shareHolder->id)>{{ $shareHolder->name }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-lg-4">
                    <span>*Amount:</span>
                    <input type="number" name="amount" value="{{ old('amount') }}" placeholder="Amount" autocomplete="off" class="form-control input-sm" required>
                </div>
                <div class="col-lg-4">
                    <span>*Pay Method:</span>
                    <select name="pay_method" class="form-control input-sm" required>
                        <option value="">Select</option>
                        <option value="CASH" @selected(old('pay_method') === 'CASH')>CASH</option>
                        <option value="BANK" @selected(old('pay_method') === 'BANK')>BANK</option>
                    </select>
                </div>
                <div class="col-lg-6">
                    <span>*Receipt no:</span>
                    <input type="number" name="recept" value="{{ old('recept') }}" placeholder="Receipt" autocomplete="off" class="form-control input-sm">
                </div>
                <div class="col-lg-6">
                    <span>*Cheque Number:</span>
                    <input type="number" name="chaque_no" value="{{ old('chaque_no') }}" placeholder="Cheque number" autocomplete="off" class="form-control input-sm">
                </div>
            </div>
            <br>
            <div class="text-center">
                <button type="submit" class="btn btn-primary"><i class="icon-drawer"></i>Save</button>
            </div>
        </form>
    </x-card>

    <x-card title="Capital">
        <div class="table-responsive">
            <table class="table table-hover dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No</th>
                        <th>Share Holder</th>
                        <th>Amount</th>
                        <th>Pay method</th>
                        <th>Receipt no</th>
                        <th>Chaque no</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($shareHolders as $shareHolder)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $shareHolder->name }}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                        @foreach ($shareHolder->capitals as $capital)
                            <tr>
                                <td></td>
                                <td></td>
                                <td>{{ money($capital->amount) }}</td>
                                <td>{{ $capital->pay_method }}</td>
                                <td>{{ $capital->receipt_number ?: '-' }}</td>
                                <td>{{ $capital->cheque_number ?: '-' }}</td>
                                <td>{{ $capital->created_at->format('Y-m-d H:i:s') }}</td>
                                <td></td>
                            </tr>
                        @endforeach
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2"><b>SHARE HOLDER CAPITAL</b></td>
                        <td><b>{{ money($shareHolderCapital) }}</b></td>
                        <td colspan="5"></td>
                    </tr>
                    <tr>
                        <td colspan="2"><b>TOTAL COMPANY CAPITAL</b></td>
                        <td><b>{{ money($companyCapital) }}</b></td>
                        <td colspan="5"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>
@endsection
