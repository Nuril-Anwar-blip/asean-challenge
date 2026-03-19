<?php

use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;
use App\Http\Controllers\ApilaController;

// APILA - AI Law Assistant is the main landing page
Route::get('/', [ApilaController::class, 'index'])->name('home');

// Dashboard (requires auth)
Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';

// APILA API Routes
Route::post('/apila/chat', [ApilaController::class, 'store'])->name('apila.chat.store');