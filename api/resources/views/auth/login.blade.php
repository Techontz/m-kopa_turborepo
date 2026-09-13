<!doctype html>
<html lang="en">
<head>
    <title>:MIKOPOFASTA: Login</title>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=Edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
    <link rel="icon" href="{{ asset('favicon.ico') }}" type="image/x-icon">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap">
    <link rel="stylesheet" href="{{ asset('vendor/bootstrap/bootstrap.min.css') }}">
    <link rel="stylesheet" href="{{ asset('vendor/font-awesome/css/font-awesome.min.css') }}">
    <link rel="stylesheet" href="{{ asset('vendor/sweetalert/sweetalert.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/app.css') }}?v={{ filemtime(public_path('assets/css/app.css')) }}">
</head>
<body class="auth-page">
<div id="wrapper">
    <div class="vertical-align-wrap">
        <div class="vertical-align-middle auth-main">
            <div class="auth-box">
                <div class="top"></div>
                <div class="card">
                    <div class="header">
                        <p class="lead">Login to your account</p>
                    </div>
                    <div class="body">
                        <form action="{{ route('login.attempt') }}" class="form-auth-small" method="post" accept-charset="utf-8">
                            @csrf
                            <div class="form-group">
                                <label for="signin-phone" class="control-label sr-only">Phone number</label>
                                <input type="number" class="form-control" id="signin-phone" name="comp_phone" value="{{ old('comp_phone') }}" placeholder="Eg.0753(XXXX)34" required autocomplete="off">
                            </div>
                            <div class="form-group mt-3">
                                <label for="signin-password" class="control-label sr-only">Password</label>
                                <input type="password" class="form-control" id="signin-password" name="password" placeholder="******" required>
                            </div>
                            <button type="submit" class="btn btn-warning btn-lg btn-block">LOGIN</button>
                            <div class="bottom"></div>
                        </form>
                    </div>
                </div>
            </div>
            <marquee direction="right"><h5>FASTAMIKOPO MICROFINANCE &copy; {{ now()->year }}</h5></marquee>
        </div>
    </div>
</div>
<script src="{{ asset('vendor/sweetalert/sweetalert.min.js') }}"></script>
@include('partials.flash')
</body>
</html>
