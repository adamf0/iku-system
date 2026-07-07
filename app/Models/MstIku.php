<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MstIku extends Model
{
    protected $table = 'mst_iku';
    protected $primaryKey = 'kode_iku';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'kode_iku',
        'nama_indikator',
        'sasaran_strategis',
        'sifat',
        'satuan',
        'kelompok',
        'formula_text',
        'variabel_kunci',
        'sumber_data',
        'arah_penilaian',
        'induk_iku',
        'berbasis_rasio',
        'is_active',
        'baseline',
        'target'
    ];

    public function subIndicators()
    {
        return $this->hasMany(MstIku::class, 'induk_iku', 'kode_iku');
    }

    public function parentIndicator()
    {
        return $this->belongsTo(MstIku::class, 'induk_iku', 'kode_iku');
    }
}
