<nav class="navbar navbar-fixed-top">
    <div class="navbar-btn">
        <button type="button" class="btn-toggle-offcanvas"><i class="icon-list"></i></button>
    </div>
    <div class="navbar-brand">
        <a href="{{ route('dashboard') }}"><img src="{{ asset('assets/img/logomkp.png') }}" alt="MikopoFasta" class="img-responsive logo"></a>
    </div>
    <div class="navbar-right">
        <form id="navbar-search" class="navbar-form search-form" onsubmit="return false;">
            <select class="form-control select2 js-location-select" style="width: 300px;">
                <option value="">Select customer</option>
                @foreach ($navbarCustomers as $navCustomer)
                    <option value="{{ route('customers.show', $navCustomer) }}">{{ $navCustomer->full_name }}</option>
                @endforeach
            </select>
        </form>
        <div id="navbar-menu">
            <ul class="nav navbar-nav">
                <li><a href="javascript:;" class="icon-menu d-none d-sm-block d-md-none d-lg-block"><i class="icon-calendar"></i></a></li>
                <li><a href="javascript:;" class="icon-menu d-none d-sm-block"><i class="icon-bubbles"></i></a></li>
                <li><a href="javascript:;" class="icon-menu d-none d-sm-block"><i class="icon-envelope"></i><span class="notification-dot"></span></a></li>
                <li><a href="javascript:;" class="icon-menu"><i class="icon-bell"></i><span class="notification-dot"></span></a></li>
                <li><a href="{{ route('settings.company') }}" class="icon-menu d-none d-sm-block"><i class="icon-equalizer"></i></a></li>
                <li>
                    <form method="POST" action="{{ route('logout') }}" class="d-inline">
                        @csrf
                        <button type="submit" class="icon-menu btn btn-link p-0" style="padding: 15px !important;"><i class="icon-login"></i></button>
                    </form>
                </li>
            </ul>
        </div>
    </div>
</nav>
