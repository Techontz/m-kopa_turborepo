@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Clientless transaction</li>
    <li class="breadcrumb-item active">mode of payment</li>
@endsection

@section('content')
    <x-card title="Mode of Payment List">
        <x-slot:actions>
            <x-header-button target="addcontact2" icon="icon-pencil" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Mode of payment</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($modes as $mode)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $mode->name }}</td>
                            <td>
                                <x-action-button :action="route('payment-modes.destroy', $mode)" method="DELETE" confirm="Are you sure?" icon="icon-trash" class="btn btn-sm btn-danger" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-modal id="addcontact2" title="Register Mode of Payment" :action="route('payment-modes.store')" submit="save" size="">
        <div class="row clearfix">
            <div class="col-md-12">
                <span>Mode of payment</span>
                <input type="text" name="pay_mode" class="form-control" placeholder="Enter Amount" autocomplete="off" required>
            </div>
        </div>
    </x-modal>
@endsection
