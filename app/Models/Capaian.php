<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Capaian extends Model
{
    protected $table = 'capaian';
    protected $primaryKey = 'id_capaian';

    protected $fillable = [
        'id_capaian',
        'kode_iku',
        'kode_unit',
        'tahun',
        'triwulan',
        'nilai_pembilang',
        'nilai_penyebut',
        'nilai_capaian',
        'target_capaian',
        'status_validasi',
        'catatan',
        'diinput_oleh',
        'tanggal_input',
        'diverifikasi_oleh',
        'tanggal_verifikasi',
        'alasan_penolakan',
        'disahkan_oleh',
        'tanggal_pengesahan'
    ];

    public function iku()
    {
        return $this->belongsTo(MstIku::class, 'kode_iku', 'kode_iku');
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class, 'kode_unit', 'kode_unit');
    }

    public function rincian()
    {
        return $this->hasMany(Rincian::class, 'id_capaian', 'id_capaian');
    }

    public function bukti()
    {
        return $this->hasMany(Bukti::class, 'id_capaian', 'id_capaian');
    }
}
