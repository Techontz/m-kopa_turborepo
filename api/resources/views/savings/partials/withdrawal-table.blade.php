<div class="table-responsive">
    <table class="table table-hover js-basic-example dataTable table-custom">
        <thead class="thead-info">
            <tr>
                <th><b>Branch</b></th>
                <th><b>Customer</b></th>
                <th><b>Description</b></th>
                <th><b>Amount</b></th>
                <th><b>Date</b></th>
                @if ($withAction)
                    <th><b>Action</b></th>
                @endif
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $saving)
                <tr>
                    <td>{{ $saving->branch?->name }}</td>
                    <td>{{ $saving->customer?->full_name }}</td>
                    <td>{{ $saving->description }}</td>
                    <td>{{ money($saving->amount) }}</td>
                    <td>{{ $saving->transaction_date->format('Y-m-d') }}</td>
                    @if ($withAction)
                        <td>
                            <a href="{{ route('savings.show', $saving->customer_id) }}" class="btn btn-sm btn-info" title="view"><i class="icon-eye"></i></a>
                        </td>
                    @endif
                </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr>
                <td><b>TOTAL:</b></td>
                <td></td>
                <td></td>
                <td><b>{{ money($rows->sum('amount')) }}</b></td>
                <td></td>
                @if ($withAction)
                    <td></td>
                @endif
            </tr>
        </tfoot>
    </table>
</div>
