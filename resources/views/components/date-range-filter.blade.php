@props([
    'id' => 'addcontact2',
    'action',
    'branches' => null,
    'branchPlaceholder' => 'Select Branch',
    'allLabel' => 'ALL',
    'dates' => true,
    'datesRequired' => true,
])

<x-modal :id="$id" :action="$action" method="GET" submit="Filter">
    <div class="row">
        @if ($branches)
            <div class="col-md-12 mb-2">
                <x-branch-select :branches="$branches" :placeholder="$branchPlaceholder" all :all-label="$allLabel" :selected="request('blanch_id')" />
            </div>
        @endif
        {{ $slot }}
        @if ($dates)
            <div class="col-md-6">
                <span>From:</span>
                <input type="date" name="from" class="form-control" value="{{ request('from') }}" @required($datesRequired)>
            </div>
            <div class="col-md-6">
                <span>To:</span>
                <input type="date" name="to" class="form-control" value="{{ request('to') }}" @required($datesRequired)>
            </div>
        @endif
    </div>
</x-modal>
