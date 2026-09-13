{{-- Live "Bad Debit" tab points to admin/new_bad_debit, which has no route in this app; it links to the write-off list instead. --}}
@include('reports.partials.tabs', ['tabs' => [
    route('reports.write-off') => 'Write-off loan',
    route('reports.write-off').'?bad_debit=1' => 'Bad Debit',
    route('reports.write-off-done') => 'Bad Debit Done',
]])
