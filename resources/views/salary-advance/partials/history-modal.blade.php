<x-modal :id="'addcontact2'.$advance->id" :title="'Deposit History ('.$advance->customer?->full_name.')'">
    <div class="table-responsive">
        <table class="table table-hover js-basic-example dataTable table-custom">
            <thead class="thead-info">
                <tr>
                    <th>S/No.</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($advance->payments as $payment)
                    <tr>
                        <td>{{ $loop->iteration }}.</td>
                        <td>{{ money($payment->amount) }}</td>
                        <td>{{ $payment->created_at?->format('Y-m-d H:i:s') }}</td>
                        <td></td>
                    </tr>
                @endforeach
            </tbody>
            <tfoot>
                <tr>
                    <td><b>TOTAL:</b></td>
                    <td><b>{{ money($advance->payments->sum('amount')) }}</b></td>
                    <td></td>
                    <td></td>
                </tr>
            </tfoot>
        </table>
    </div>
</x-modal>
