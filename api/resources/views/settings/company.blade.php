@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Setting</li>
    <li class="breadcrumb-item active">Company Profile</li>
@endsection

@php
    $activeTab = old('oldpass') !== null || $errors->hasAny(['oldpass', 'newpass', 'passconf']) ? 'Account' : ($errors->has('comp_logo') ? 'General' : 'Basic');
@endphp

@section('content')
    <div class="card">
        <div class="body">
            <ul class="nav nav-tabs-new profile-tabs">
                <li class="nav-item"><a class="nav-link @if ($activeTab === 'Basic') active @endif" data-toggle="tab" href="#Basic">Basic</a></li>
                <li class="nav-item"><a class="nav-link @if ($activeTab === 'Account') active @endif" data-toggle="tab" href="#Account">Change Password</a></li>
                <li class="nav-item"><a class="nav-link @if ($activeTab === 'General') active @endif" data-toggle="tab" href="#General">Logo</a></li>
            </ul>
        </div>
    </div>

    <div class="tab-content padding-0">
        <div class="tab-pane @if ($activeTab === 'Basic') active @endif" id="Basic">
            <div class="card">
                <div class="body">
                    <h6>Company Information</h6>
                    <form action="{{ route('settings.company.update') }}" method="POST">
                        @csrf
                        @method('PUT')
                        <div class="row">
                            <div class="col-lg-4 col-6">
                                <span>Company Name:</span>
                                <input type="text" name="comp_name" value="{{ old('comp_name', $company->name) }}" placeholder="First name" autocomplete="off" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-6">
                                <span>Company Reg/No:</span>
                                <input type="text" name="comp_number" value="{{ old('comp_number', $company->registration_number) }}" placeholder="Middle name" autocomplete="off" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-6">
                                <span>Address:</span>
                                <input type="text" name="adress" value="{{ old('adress', $company->address) }}" autocomplete="off" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-6">
                                <span>Phone Number:</span>
                                <input type="number" name="comp_phone" value="{{ old('comp_phone', $company->phone) }}" autocomplete="off" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-12">
                                <span>Email:</span>
                                <input type="email" name="comp_email" value="{{ old('comp_email', $company->email) }}" autocomplete="off" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-12">
                                <span>Region:</span>
                                <select name="region_id" class="form-control select2" required>
                                    @foreach ($regions as $region)
                                        <option value="{{ $region->id }}" @selected((string) old('region_id', $company->region_id) === (string) $region->id)>{{ $region->name }}</option>
                                    @endforeach
                                </select>
                            </div>
                        </div>
                        <br>
                        <div class="text-center">
                            <button type="submit" class="btn btn-primary">Update</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="tab-pane @if ($activeTab === 'Account') active @endif" id="Account">
            <div class="card">
                <div class="body">
                    <div class="header p-0 m-b-20">
                        <h2>Change Password</h2>
                    </div>
                    <form action="{{ route('settings.password') }}" method="POST">
                        @csrf
                        @method('PUT')
                        <div class="row">
                            <div class="col-lg-4 col-12">
                                <span>Old Password:</span>
                                <input type="password" name="oldpass" placeholder="******" autocomplete="off" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-12">
                                <span>New Password:</span>
                                <input type="password" name="newpass" placeholder="******" autocomplete="off" class="form-control input-sm" required>
                            </div>
                            <div class="col-lg-4 col-12">
                                <span>Confirm Password:</span>
                                <input type="password" name="passconf" placeholder="******" autocomplete="off" class="form-control input-sm" required>
                            </div>
                        </div>
                        <br>
                        <div class="text-center">
                            <button type="submit" class="btn btn-primary"><i class="icon-key"></i> Change password</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="tab-pane @if ($activeTab === 'General') active @endif" id="General">
            <x-card title="Company Logo">
                <form action="{{ route('settings.logo') }}" method="POST" enctype="multipart/form-data">
                    @csrf
                    <div class="row">
                        <div class="col-md-6 col-6">
                            <div class="form-group">
                                <span>Logo</span>
                                <input type="file" name="comp_logo" class="form-control" accept="image/*" required>
                            </div>
                        </div>
                        <div class="col-md-6 col-6">
                            <div class="form-group">
                                <img src="{{ $company->logo ? asset('storage/'.$company->logo) : asset('assets/img/fulllogo_transparent.png') }}" class="rounded-circle company-logo" alt="company logo">
                            </div>
                        </div>
                    </div>
                    <div class="text-center">
                        <button type="submit" class="btn btn-primary">Update</button>
                    </div>
                </form>
            </x-card>
        </div>
    </div>
@endsection

@push('styles')
    <style>
        .company-logo { max-width: 200px; max-height: 200px; }
    </style>
@endpush
