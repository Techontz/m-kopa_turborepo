@props([
    'id',
    'title' => null,
    'action' => null,
    'method' => 'POST',
    'submit' => null,
    'size' => '',
    'files' => false,
])

@push('modals')
<div class="modal fade" id="{{ $id }}" tabindex="-1" role="dialog">
    <div class="modal-dialog {{ $size }}" role="document">
        <div class="modal-content">
            @if ($action)
                <form action="{{ $action }}" method="{{ strtoupper($method) === 'GET' ? 'GET' : 'POST' }}" @if ($files) enctype="multipart/form-data" @endif>
                    @if (strtoupper($method) !== 'GET')
                        @csrf
                        @if (! in_array(strtoupper($method), ['GET', 'POST'], true))
                            @method($method)
                        @endif
                    @endif
            @endif
            @if ($title)
                <div class="modal-header">
                    <h6 class="title">{{ $title }}</h6>
                </div>
            @endif
            <div class="modal-body">
                {{ $slot }}
            </div>
            <div class="modal-footer">
                @if ($submit)
                    <button type="submit" class="btn btn-primary">{{ $submit }}</button>
                @endif
                <button type="button" class="btn btn-secondary" data-dismiss="modal">CLOSE</button>
            </div>
            @if ($action)
                </form>
            @endif
        </div>
    </div>
</div>
@endpush
