{{-- "Select Branch (+ALL) / From / To" filter modal, submitted as GET to the same page. --}}
@php
    $today = now()->format('Y-m-d');
@endphp
<x-modal :id="$id ?? 'addcontact2'" :title="$title ?? 'Filter'" :action="$action" method="GET" submit="Filter" size="">
    <div class="row clearfix">
        @unless ($datesFirst ?? false)
            <div class="col-md-12 col-12">
                <span>Select Branch:</span>
                <x-branch-select :branches="$branches" :placeholder="$placeholder ?? 'Select Branch'" all :selected="request('blanch_id')" />
            </div>
        @endunless
        <div class="col-md-6 col-6">
            <span>From:</span>
            <input type="date" class="form-control" value="{{ request('from', $today) }}" placeholder="From" name="from" autocomplete="off" required>
        </div>
        <div class="col-md-6 col-6">
            <span>To:</span>
            <input type="date" class="form-control" value="{{ request('to', $today) }}" placeholder="From" name="to" autocomplete="off" required>
        </div>
        @if ($datesFirst ?? false)
            <div class="col-md-12 col-12">
                <span>Select Branch:</span>
                <x-branch-select :branches="$branches" :placeholder="$placeholder ?? 'Select Branch'" all :selected="request('blanch_id')" />
            </div>
        @endif
    </div>
</x-modal>
