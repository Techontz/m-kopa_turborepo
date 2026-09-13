{{-- Allowance / Deduction lists on the employee profile. Expects: $items --}}
<div class="table-responsive">
    <table class="table table-hover js-basic-example dataTable table-custom">
        <thead class="thead-info">
            <tr>
                <th>S/No.</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Status</th>
                <th>Date</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($items as $item)
                <tr>
                    <td>{{ $loop->iteration }}.</td>
                    <td>{{ money($item->amount) }}</td>
                    <td>{{ $item->description }}</td>
                    <td><span class="badge {{ $item->status === 'active' ? 'badge-success' : 'badge-info' }}">{{ $item->status }}</span></td>
                    <td>{{ $item->created_at->format('Y-m-d H:i:s') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>
