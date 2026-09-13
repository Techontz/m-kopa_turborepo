{{-- "(1).Upload Passport" + "(2). NIDA / Voter ID" cards. Expects: $customer, $documentsAction, $saveLabel --}}
<div class="card">
    <div class="header">
        <h2>(1).Upload Passport</h2>
        <div class="header-dropdown">
            <img src="{{ asset('assets/img/que.png') }}" style="width: 25px; height: 25px;" alt="">
        </div>
    </div>
    <div class="body">
        <div class="row">
            <div class="col-lg-4 col-6">
                <br><br>
                <span>Passport size</span>
                <div class="input-group">
                    <div class="input-group-prepend"><span class="input-group-text"><i class="icon-user"></i></span></div>
                    <input type="file" accept="image/*" class="form-control js-crop-input" data-upload-url="{{ route('customers.photo', $customer) }}" data-preview="#passport-preview">
                </div>
            </div>
            <div class="col-lg-4 col-6">
                <img id="passport-preview" src="{{ $customer->passport_photo ? $customer->photo_url : asset('assets/img/male.jpeg') }}" class="img-thumbnail" alt="customer image" style="width: 135px; height: 135px;">
            </div>
        </div>
    </div>
</div>

<div class="card">
    <div class="body">
        <div class="header px-0 pt-0 d-flex justify-content-between">
            <h6>(2). NIDA / Voter ID / Driver`s Lisence number</h6>
            <img src="{{ asset('assets/img/que.png') }}" style="width: 25px; height: 25px;" alt="">
        </div>
        <form action="{{ $documentsAction }}" method="POST" enctype="multipart/form-data">
            @csrf
            <div class="row">
                <div class="col-sm-4 col-12">
                    <div class="form-group">
                        <label class="font-weight-bold">ID number</label>
                        <div class="input-group">
                            <div class="input-group-prepend"><span class="input-group-text"><i class="icon-users"></i></span></div>
                            <input type="text" class="form-control" name="natinal_identity" value="{{ old('natinal_identity', $customer->id_number) }}" autocomplete="off">
                        </div>
                    </div>
                </div>
                <div class="col-sm-4 col-12">
                    <div class="form-group">
                        <label class="font-weight-bold">Upload Attachment(pdf)</label>
                        <div class="input-group">
                            <div class="input-group-prepend"><span class="input-group-text"><i class="icon-docs"></i></span></div>
                            <input type="file" class="form-control" name="signature" accept="application/pdf" @required(! $customer->id_attachment)>
                        </div>
                    </div>
                </div>
                <div class="col-sm-4 col-12">
                    <div class="form-group">
                        <label class="font-weight-bold">Documents</label>
                        <div class="input-group">
                            @if ($customer->id_attachment)
                                <a href="{{ asset('storage/'.$customer->id_attachment) }}" target="_blank"><img src="{{ asset('assets/img/pdf.png') }}" class="doc-icon m-r-5" alt="PDF"></a>
                            @else
                                <img src="{{ asset('assets/img/pdf.png') }}" class="doc-icon m-r-5" alt="PDF">
                            @endif
                        </div>
                    </div>
                </div>
            </div>
            <button class="btn btn-info btn-block" type="submit">{{ $saveLabel }}</button>
        </form>
    </div>
    @isset($backUrl)
        <div class="row">
            <div class="col-lg-6 col-6">
                <a href="{{ $backUrl }}" class="btn btn-warning btn-block text-white"><i class="icon-arrow-left"></i>back</a>
            </div>
        </div>
    @endisset
</div>

@once
    @push('modals')
        <div class="modal fade" id="crop-modal" tabindex="-1" role="dialog" aria-hidden="true">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"></h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6 col-6"><img id="crop-image" alt="" style="max-width: 100%;"></div>
                            <div class="col-md-6 col-6"><div class="preview" style="width: 160px; height: 160px; overflow: hidden;"></div></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-info" id="crop-button">Upload</button>
                    </div>
                </div>
            </div>
        </div>
    @endpush
@endonce
