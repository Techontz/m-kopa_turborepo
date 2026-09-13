{{-- "All Loans" table. Expects: $loans --}}
<div class="table-responsive">
    <table class="table table-hover js-basic-example dataTable table-custom">
        <thead class="thead-info">
            <tr>
                <th>S/no.</th>
                <th>Loan Ac</th>
                <th>Loan Product</th>
                <th>Loan Interest</th>
                <th>Loan Withdrawal</th>
                <th>Principal + interest</th>
                <th>Duration Type</th>
                <th>Number of Repayment</th>
                <th>Restoration</th>
                <th>Status</th>
                <th>Withdrawal Date</th>
                <th>End Date</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($loans as $loan)
                <tr>
                    <td>{{ $loop->iteration }}.</td>
                    <td><a href="{{ route('loans.show', $loan) }}">{{ $loan->loan_number }}</a></td>
                    <td>{{ $loan->category?->name }}</td>
                    <td>{{ rtrim(rtrim(number_format((float) $loan->interest_rate, 2), '0'), '.') }}%</td>
                    <td>{{ money($loan->withdrawn_at ? $loan->amount_approved : 0) }}</td>
                    <td>{{ money($loan->withdrawn_at ? $loan->total_payable : 0) }}</td>
                    <td>{{ $loan->duration->label() }}</td>
                    <td>{{ $loan->sessions }}</td>
                    <td>{{ money($loan->withdrawn_at ? $loan->restoration : 0) }}</td>
                    <td><a href="javascript:;" class="badge badge-{{ $loan->status->badge() }}">{{ $loan->status->label() }}</a></td>
                    <td>{{ $loan->withdrawn_at?->toDateString() }}</td>
                    <td>{{ $loan->end_date?->toDateString() }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>
