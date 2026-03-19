<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    protected $fillable = ['chat_id', 'role', 'content', 'sources'];

    protected $casts = [
        'sources' => 'array',
    ];

    public function chat()
    {
        return $this->belongsTo(Chat::class);
    }
}
