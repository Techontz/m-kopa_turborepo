@php
    $flashSuccess = session('success');
    $flashError = session('error') ?? ($errors->any() ? $errors->first() : null);
@endphp
@if ($flashSuccess || $flashError)
    <script>
        swal({
            title: @json($flashSuccess ?? $flashError),
            type: @json($flashSuccess ? 'success' : 'warning'),
            confirmButtonText: 'Yes!',
        });
    </script>
@endif
