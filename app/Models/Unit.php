<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Unit extends Model
{
    protected $table = 'units';
    protected $primaryKey = 'kode_unit';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'kode_unit',
        'nama_unit',
        'jenjang',
        'unit_induk'
    ];
}
