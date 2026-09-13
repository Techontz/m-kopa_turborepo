<!doctype html>
<html lang="sw">
<head>
    <meta charset="utf-8">
    <title>Mkataba wa Mkopo - {{ $loan->loan_number }}</title>
    <link rel="stylesheet" href="{{ asset('vendor/bootstrap/bootstrap.min.css') }}">
    <style>
        body { font-family: "Times New Roman", serif; font-size: 14px; padding: 30px; color: #000; }
        h3, h4 { text-align: center; text-transform: uppercase; }
        .table td, .table th { padding: 6px; border: 1px solid #000; }
        .signature { margin-top: 50px; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body onload="window.print()">
    {{--
        The live system generates this agreement as a PDF download whose layout could not be captured.
        This printable page contains the same loan, customer, guarantor and collateral details.
    --}}
    <div class="text-center">
        <img src="{{ $loan->company->logo ? asset('storage/'.$loan->company->logo) : asset('assets/img/logomkp.png') }}" style="width: 120px;" alt="">
        <h3>{{ $loan->company->name }}</h3>
        <p>{{ $loan->company->address }} | {{ $loan->company->phone }} | {{ $loan->company->email }}</p>
        <h4>Mkataba wa Mkopo / Loan Agreement</h4>
    </div>

    <table class="table">
        <tr><th>Loan Ac</th><td>{{ $loan->loan_number }}</td><th>Branch</th><td>{{ $loan->branch->name }}</td></tr>
        <tr><th>Customer</th><td>{{ $loan->customer->full_name }} ({{ $loan->customer->customer_code }})</td><th>Phone</th><td>{{ $loan->customer->phone }}</td></tr>
        <tr><th>Address</th><td colspan="3">{{ collect([$loan->customer->region?->name, $loan->customer->district, $loan->customer->ward, $loan->customer->street])->filter()->implode(', ') }}</td></tr>
        <tr><th>Loan Product</th><td>{{ $loan->category->name }}</td><th>Interest</th><td>{{ rtrim(rtrim(number_format((float) $loan->interest_rate, 2), '0'), '.') }}% ({{ $loan->formula }})</td></tr>
        <tr><th>Loan Aproved</th><td>{{ money($loan->amount_approved) }}</td><th>Principal + Interest</th><td>{{ money($loan->total_payable) }}</td></tr>
        <tr><th>Duration</th><td>{{ $loan->duration->label() }} / {{ $loan->sessions }}</td><th>Restoration</th><td>{{ money($loan->restoration) }}</td></tr>
        <tr><th>Loan Fee</th><td>{{ money($loan->fee_deduct ? $loan->loan_fee : 0) }}</td><th>Insurance</th><td>{{ money($loan->insurance) }}</td></tr>
    </table>

    <h5>Guarantors</h5>
    <table class="table">
        <tr><th>Full Name</th><th>Phone Number</th><th>Relationship</th><th>Identification No</th></tr>
        @foreach ($loan->guarantors as $guarantor)
            <tr><td>{{ trim($guarantor->first_name.' '.$guarantor->middle_name.' '.$guarantor->last_name) }}</td><td>{{ $guarantor->phone }}</td><td>{{ $guarantor->relationship }}</td><td>{{ $guarantor->id_number }}</td></tr>
        @endforeach
    </table>

    <h5>Collateral</h5>
    <table class="table">
        <tr><th>Collateral Name</th><th>Collateral type</th><th>Collateral Location</th><th>Collateral Value</th></tr>
        @foreach ($loan->collaterals as $collateral)
            <tr><td>{{ $collateral->name }}</td><td>{{ $collateral->type }}</td><td>{{ $collateral->location }}</td><td>{{ money($collateral->value) }}</td></tr>
        @endforeach
    </table>

    <div class="row signature">
        <div class="col-4 text-center">______________________<br>Sahihi ya Mkopaji</div>
        <div class="col-4 text-center">______________________<br>Sahihi ya Mdhamini</div>
        <div class="col-4 text-center">______________________<br>Afisa Mikopo</div>
    </div>

    <p class="text-center mt-4 no-print"><button onclick="window.print()" class="btn btn-primary">Print</button></p>
</body>
</html>
