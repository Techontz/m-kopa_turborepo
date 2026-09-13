<x-modal id="addcontact4" title="Balance" size="">
    <div class="table-responsive">
        <table class="table table-hover dataTable table-custom" data-no-datatable>
            <thead class="thead-info">
                <tr>
                    <th>S/no.</th>
                    <th>branch</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($balances as $balance)
                    <tr>
                        <td>{{ $loop->iteration }}.</td>
                        <td>{{ $balance['branch']->name }}</td>
                        <td>{{ money($balance['amount']) }}</td>
                    </tr>
                @endforeach
                <tr>
                    <td><b>TOTAL</b></td>
                    <td></td>
                    <td><b>{{ money($balances->sum('amount')) }}</b></td>
                </tr>
            </tbody>
        </table>
    </div>
</x-modal>
