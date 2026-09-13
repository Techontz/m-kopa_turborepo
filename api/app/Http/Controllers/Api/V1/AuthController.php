<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\EmployeeResource;
use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Phone + password login (live: "Login to your account"). Issues a Sanctum token.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'phone' => ['required', 'string', 'max:20'],
            'password' => ['required', 'string'],
            'device' => ['nullable', 'string', 'max:100'],
        ]);

        $employee = Employee::with(['company', 'branch', 'role.permissions', 'zone'])->where('phone', $credentials['phone'])->first();

        if ($employee === null || ! Hash::check($credentials['password'], $employee->password)) {
            throw ValidationException::withMessages(['phone' => 'Phone number or password is incorrect']);
        }

        if ($employee->status !== 'active') {
            throw ValidationException::withMessages(['phone' => 'Your account is not active. Contact the administrator.']);
        }

        $token = $employee->createToken($credentials['device'] ?? 'web')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new EmployeeResource($employee),
        ]);
    }

    public function me(Request $request): EmployeeResource
    {
        return new EmployeeResource($request->user()->load(['company', 'branch', 'role.permissions', 'zone']));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out']);
    }
}
