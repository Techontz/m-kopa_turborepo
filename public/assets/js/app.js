/*
 * Shared page behaviour (mirrors the jQuery plugins used on the live system).
 */
(function ($) {
    'use strict';

    $.ajaxSetup({ headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') } });

    /* Sidebar: collapsible groups and off-canvas toggle */
    $(document).on('click', '.js-menu-toggle', function (event) {
        event.preventDefault();
        var $item = $(this).parent('li');
        $item.siblings('li.open').removeClass('open');
        $item.toggleClass('open');
    });
    $(document).on('click', '.btn-toggle-offcanvas', function () {
        $('body').toggleClass('offcanvas-active');
    });

    /* DataTables with the live defaults (Show 10 entries / Search / pagination) */
    $('.js-basic-example').each(function () {
        if (!$(this).is('[data-no-datatable]')) {
            $(this).DataTable({ pageLength: 10, order: [], autoWidth: false });
        }
    });

    /* Select2 */
    function initSelect2(context) {
        $(context).find('select.select2').each(function () {
            var $modal = $(this).closest('.modal');
            $(this).select2({ width: $(this).data('width') || '100%', dropdownParent: $modal.length ? $modal : $(document.body) });
        });
    }
    initSelect2(document);

    /* Selecting a customer from a "Select customer" box navigates to the option URL */
    $(document).on('change', '.js-location-select', function () {
        if (this.value) {
            window.location = this.value;
        }
    });

    /* Date of birth → Year (age) */
    $(document).on('change', '[data-age-target]', function () {
        var dob = new Date(this.value);
        if (isNaN(dob.getTime())) {
            return;
        }
        $($(this).data('age-target')).val(new Date().getFullYear() - dob.getFullYear());
    });

    /* Dependent dropdowns: <select data-dependent-url="..." data-dependent-target="#x" data-dependent-param="branch_id"> */
    $(document).on('change', 'select[data-dependent-url]', function () {
        var $source = $(this);
        var targets = String($source.data('dependent-target')).split(',');
        var urls = String($source.data('dependent-url')).split(',');
        if (!$source.val()) {
            return;
        }
        $.each(urls, function (index, url) {
            var params = {};
            params[$source.data('dependent-param') || 'id'] = $source.val();
            $.get(url, params, function (html) {
                $(targets[index] || targets[0]).html(html).trigger('change.select2');
            });
        });
    });

    /* Thousands separators while typing amounts (live: x-mask $money) */
    $(document).on('input', '.js-money-input', function () {
        var digits = this.value.replace(/[^\d]/g, '');
        this.value = digits ? Number(digits).toLocaleString('en-US') : '';
    });

    /* Native confirm dialogs, as used throughout the live system */
    $(document).on('submit', 'form[data-confirm]', function (event) {
        if (!window.confirm($(this).data('confirm'))) {
            event.preventDefault();
        }
    });

    /* Passport photo: pick → crop (1:1, 160x160) → upload */
    var cropper = null;
    var $cropInput = null;
    $(document).on('change', '.js-crop-input', function (event) {
        var files = event.target.files;
        if (!files || !files.length) {
            return;
        }
        $cropInput = $(this);
        $('#crop-image').attr('src', URL.createObjectURL(files[0]));
        $('#crop-modal').modal('show');
    });
    $('#crop-modal').on('shown.bs.modal', function () {
        cropper = new Cropper(document.getElementById('crop-image'), { aspectRatio: 1, viewMode: 3, preview: '.preview' });
    }).on('hidden.bs.modal', function () {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
    });
    $(document).on('click', '#crop-button', function () {
        if (!cropper || !$cropInput) {
            return;
        }
        cropper.getCroppedCanvas({ width: 160, height: 160 }).toBlob(function (blob) {
            var reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onload = function () {
                $.post($cropInput.data('upload-url'), { image: reader.result }, function (response) {
                    $('#crop-modal').modal('hide');
                    $($cropInput.data('preview')).attr('src', response.url);
                    swal({ title: 'Passport uploaded successfully', type: 'success', confirmButtonText: 'Yes!' });
                });
            };
        });
    });
})(jQuery);
