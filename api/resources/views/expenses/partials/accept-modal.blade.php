<x-modal :id="'acceptExpense'.$expenseRequest->id" title="Expences Accept Comment" :action="route('expense-requests.accept', $expenseRequest)" submit="Accept" size="">
    <div class="row clearfix">
        <div class="col-md-12 col-12">
            <span>Comment:</span>
            <textarea name="req_comment" class="form-control" rows="4" autocomplete="off">{{ $expenseRequest->comment }}</textarea>
        </div>
        <div class="col-md-12 col-12">
            <span>Amount</span>
            <input type="number" name="req_amount" class="form-control" value="{{ (float) $expenseRequest->amount }}" autocomplete="off" required>
        </div>
    </div>
</x-modal>
