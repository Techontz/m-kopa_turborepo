<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class LoginController extends Controller
{
    public function show(): View
    {
        return view('auth.login');
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'comp_phone' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $attempt = ['phone' => $credentials['comp_phone'], 'password' => $credentials['password'], 'status' => 'active'];

        if (! Auth::attempt($attempt)) {
            return back()->withInput($request->only('comp_phone'))->with('error', 'Phone number or password is incorrect');
        }

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
