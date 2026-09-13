<div class="table-responsive">
    <table class="table table-hover js-basic-example dataTable table-custom">
        <thead class="thead-info">
            <tr>
                <th>Branch</th>
                <th>Expenses</th>
                <th>Amount</th>
                <th>Descrption</th>
                <th>Comment</th>
                <th>Date</th>
                <th>status</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($expenseRequests as $expenseRequest)
                <tr>
                    <td class="text-uppercase">{{ $expenseRequest->branch?->name }}</td>
                    <td>{{ $expenseRequest->expenseType?->name }}</td>
                    <td>{{ money($expenseRequest->amount) }}</td>
                    <td>{{ $expenseRequest->description }}</td>
                    <td>{{ $expenseRequest->comment }}</td>
                    <td>{{ $expenseRequest->request_date->format('Y-m-d') }}</td>
                    <td>
                        @if ($expenseRequest->status === 'accepted')
                            <span class="badge badge-success">Accepted</span>
                        @else
                            <span class="badge badge-danger">Not Accepted</span>
                        @endif
                    </td>
                    <td class="text-nowrap">
                        @if ($expenseRequest->status === 'pending')
                            <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#acceptExpense{{ $expenseRequest->id }}" title="Accept"><i class="icon-pencil"></i></a>
                            <x-action-button :action="route('expense-requests.destroy', $expenseRequest)" method="DELETE" confirm="Are You Sure?" icon="icon-trash" title="Reject" />
                            @include('expenses.partials.accept-modal')
                        @endif
                    </td>
                </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr>
                <td><b>TOTAL</b></td>
                <td></td>
                <td><b>{{ money($expenseRequests->sum('amount')) }}</b></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        </tfoot>
    </table>
</div>
