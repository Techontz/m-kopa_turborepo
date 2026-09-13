@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">loan</li>
    <li class="breadcrumb-item active">Edit loan</li>
@endsection

@section('content')
    <x-card title="(1).Loan Aplication Form">
        <form action="{{ route('loans.update', $loan) }}" method="POST">
            @csrf
            @method('PUT')
            <div class="row">
                <div class="col-lg-4 col-12">
                    <span>Loan category:</span>
                    <select name="category_id" class="form-control select2" required>
                        @foreach ($categories as $category)
                            <option value="{{ $category->id }}" @selected($loan->loan_category_id === $category->id)>{{ $category->name }} / {{ $category->level_label }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-lg-4 col-6">
                    <span>Loan Amount:</span>
                    <input type="text" name="how_loan" value="{{ money($loan->amount_applied) }}" class="form-control js-money-input" style="border-color: green; color: green;" placeholder="Enter Loan Amount" required>
                </div>
                <div class="col-lg-4 col-6">
                    <span>Loan Duration</span>
                    <select name="day" class="form-control" required readonly>
                        <option value="{{ $loan->duration->value }}">{{ $loan->duration->label() }}</option>
                    </select>
                </div>
                <div class="col-lg-3 col-6">
                    <span>Number of Repayments:</span>
                    <input type="number" name="session" value="{{ $loan->sessions }}" class="form-control" style="border-color: orange; color: orange;" placeholder="Enter Number of Repayments" required>
                </div>
                <div class="col-lg-3 col-6">
                    <span>*Instalment(optinal):</span>
                    <input type="number" name="instalment" value="{{ (int) $loan->instalment }}" class="form-control" placeholder="Enter Instalment">
                </div>
                <div class="col-lg-3 col-6">
                    <span class="font-weight-bold">Interest Formular:</span>
                    <select name="rate" class="form-control" required readonly>
                        <option value="{{ $loan->formula }}">{{ $loan->formula }}</option>
                    </select>
                </div>
                <div class="col-lg-3 col-6">
                    <span>Deduction Fee:</span>
                    <select name="fee_status" class="form-control" required readonly>
                        <option value="{{ $loan->fee_deduct ? 'YES' : 'NO' }}">{{ $loan->fee_deduct ? 'YES' : 'NO' }}</option>
                    </select>
                </div>
                <div class="col-lg-12">
                    <span>Reason of Applying Loan:</span>
                    <textarea name="reason" class="form-control" rows="3" placeholder="Enter Reason of Applying Loan" required>{{ $loan->reason }}</textarea>
                </div>
                <input type="hidden" name="group_id" value="{{ $loan->group_id }}">
            </div>
            <div class="text-center m-t-20">
                <button type="submit" class="btn btn-primary"><i class="icon-pencil"></i>Update</button>
                <a href="{{ route('loans.pending') }}" class="btn btn-primary"><i class="icon-arrow-left"></i></a>
            </div>
        </form>
    </x-card>

    <x-card title="(2).Guarantors">
        <div class="table-responsive">
            <table class="table table-hover table-custom">
                <thead class="thead-info"><tr><th>Passport</th><th>Full name</th><th>Phone number</th><th>Gender</th><th>Martial status</th><th>Identification No</th><th>Relationship</th><th>Adress</th></tr></thead>
                <tbody>
                    @foreach ($loan->guarantors as $guarantor)
                        <tr>
                            <td><img src="{{ $guarantor->photo ? asset('storage/'.$guarantor->photo) : asset('assets/img/default.jpeg') }}" style="width: 40px; height: 40px;" alt=""></td>
                            <td>{{ strtoupper(trim($guarantor->first_name.' '.$guarantor->middle_name.' '.$guarantor->last_name)) }}</td>
                            <td>{{ $guarantor->phone }}</td>
                            <td>{{ $guarantor->gender }}</td>
                            <td>{{ $guarantor->marital_status }}</td>
                            <td>{{ $guarantor->id_number }}</td>
                            <td>{{ $guarantor->relationship }}</td>
                            <td>{{ collect([$guarantor->region?->name, $guarantor->district, $guarantor->ward, $guarantor->street])->filter()->implode(',') }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-card title="(3).Collateral">
        <div class="table-responsive">
            <table class="table table-hover table-custom">
                <thead class="thead-info"><tr><th>S/no.</th><th>Collateral name</th><th>Collateral Type</th><th>Collateral Location</th><th>Collateral Value</th></tr></thead>
                <tbody>
                    @foreach ($loan->collaterals as $collateral)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $collateral->name }}</td>
                            <td>{{ $collateral->type }}</td>
                            <td>{{ $collateral->location }}</td>
                            <td>{{ (int) $collateral->value }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-card title="Collateral Attachment">
        <form action="{{ route('loans.collateral-attachment', $loan) }}" method="POST" enctype="multipart/form-data">
            @csrf
            <div class="row">
                <div class="col-md-4">
                    <label class="font-weight-bold">Attachment</label>
                    <div class="input-group">
                        <div class="input-group-prepend"><span class="input-group-text"><i class="icon-docs"></i></span></div>
                        <input type="file" name="attachment" accept="application/pdf" class="form-control" required>
                    </div>
                </div>
                <div class="col-md-4">
                    <label class="font-weight-bold">Document</label><br>
                    @if ($loan->collateral_attachment)
                        <a href="{{ asset('storage/'.$loan->collateral_attachment) }}" target="_blank"><img src="{{ asset('assets/img/pdf.png') }}" style="width: 45px;" alt="PDF"></a>
                    @else
                        <img src="{{ asset('assets/img/pdf.png') }}" style="width: 45px;" alt="PDF">
                    @endif
                </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block m-t-20">Update</button>
        </form>
    </x-card>
@endsection
