@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Share Holder</li>
@endsection

@section('content')
    <x-card title="Register Share Holder">
        <form action="{{ route('share-holders.store') }}" method="POST">
            @csrf
            <div class="row">
                <div class="col-md-4">
                    <span>* Full name:</span>
                    <input type="text" name="share_name" value="{{ old('share_name') }}" placeholder="Full name" autocomplete="off" class="form-control" required>
                </div>
                <div class="col-md-4">
                    <span>* Phone no:</span>
                    <input type="number" name="share_mobile" value="{{ old('share_mobile') }}" placeholder="Phone no" autocomplete="off" class="form-control" required>
                </div>
                <div class="col-lg-4">
                    <span>* Email:</span>
                    <input type="email" name="share_email" value="{{ old('share_email') }}" placeholder="Email" autocomplete="off" class="form-control" required>
                </div>
                <div class="col-md-6">
                    <span>*Gender:</span>
                    <select name="share_sex" class="form-control input-sm">
                        <option value="">Select gender</option>
                        <option value="male" @selected(old('share_sex') === 'male')>Male</option>
                        <option value="female" @selected(old('share_sex') === 'female')>Female</option>
                    </select>
                </div>
                <div class="col-md-6">
                    <span>*Date of Birth:</span>
                    <input type="date" name="share_dob" value="{{ old('share_dob') }}" placeholder="Date of Birth" autocomplete="off" class="form-control" required>
                </div>
            </div>
            <div class="text-center m-t-20">
                <button type="submit" class="btn btn-primary"><i class="icon-drawer"></i>Save</button>
            </div>
        </form>
    </x-card>

    <x-card title="Share Holder List">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Shareholder name</th>
                        <th>Phone number</th>
                        <th>Email</th>
                        <th>Sex</th>
                        <th>Date of Birth</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($shareHolders as $shareHolder)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $shareHolder->name }}</td>
                            <td>{{ $shareHolder->mobile }}</td>
                            <td>{{ $shareHolder->email }}</td>
                            <td>{{ $shareHolder->gender }}</td>
                            <td>{{ $shareHolder->date_of_birth?->format('Y-m-d') }}</td>
                            <td class="text-nowrap">
                                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#addcontact1{{ $shareHolder->id }}"><i class="icon-pencil"></i></a>
                                <x-action-button :action="route('share-holders.destroy', $shareHolder)" method="DELETE" confirm="Are You Sure?" icon="icon-trash" />
                            </td>
                        </tr>

                        <x-modal :id="'addcontact1'.$shareHolder->id" title="Edit Share Holder" :action="route('share-holders.update', $shareHolder)" method="PUT" submit="Update">
                            <div class="row clearfix">
                                <div class="col-md-4">
                                    <span>* Full name:</span>
                                    <input type="text" name="share_name" placeholder="Full name" autocomplete="off" value="{{ $shareHolder->name }}" class="form-control" required>
                                </div>
                                <div class="col-md-4">
                                    <span>* Mobile no:</span>
                                    <input type="number" name="share_mobile" placeholder="Mobile no" value="{{ $shareHolder->mobile }}" autocomplete="off" class="form-control" required>
                                </div>
                                <div class="col-md-4">
                                    <span>* Email:</span>
                                    <input type="email" name="share_email" placeholder="Email" autocomplete="off" value="{{ $shareHolder->email }}" class="form-control" required>
                                </div>
                                <div class="col-md-6">
                                    <span>*Gender:</span>
                                    <select name="share_sex" class="form-control input-sm">
                                        <option value="male" @selected($shareHolder->gender === 'male')>Male</option>
                                        <option value="female" @selected($shareHolder->gender === 'female')>Female</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <span>*Date of Birth:</span>
                                    <input type="date" name="share_dob" placeholder="Date of Birth" autocomplete="off" value="{{ $shareHolder->date_of_birth?->format('Y-m-d') }}" class="form-control" required>
                                </div>
                            </div>
                        </x-modal>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
