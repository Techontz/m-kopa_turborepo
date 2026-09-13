{{-- Filter modal with a single "Select Branch" dropdown (+ALL), submitted as GET to the same page. --}}
<x-modal :id="$id ?? 'addcontact2'" :title="$title ?? 'Filter'" :action="$action" method="GET" submit="Filter" size="">
    <div class="row clearfix">
        <div class="col-md-12 col-12">
            <span>Select Branch:</span>
            <x-branch-select :branches="$branches" :placeholder="$placeholder ?? 'Select Branch'" :all="$all ?? true" :selected="request('blanch_id')" />
        </div>
    </div>
</x-modal>
