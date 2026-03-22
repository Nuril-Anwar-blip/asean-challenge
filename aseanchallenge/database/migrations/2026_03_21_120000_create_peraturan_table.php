<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('peraturan')) {
            return;
        }

        Schema::create('peraturan', function (Blueprint $table) {
            $table->id();
            $table->string('uu_id');
            $table->text('judul')->nullable();
            $table->text('tentang')->nullable();
            $table->string('tahun')->nullable();
            $table->string('bab')->nullable();
            $table->string('pasal')->nullable();
            $table->longText('isi');
            $table->text('sumber')->nullable();
            $table->timestamps();

            $table->index('uu_id', 'idx_peraturan_uu_id');
            $table->index('tentang', 'idx_peraturan_tentang');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('peraturan');
    }
};
