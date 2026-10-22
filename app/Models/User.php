<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'role',
        'fakultas_unit',
        'is_active',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Get list of unit IDs this user has access to.
     */
    public function scopeUnits(): array
    {
        $isWarek = str_contains(strtoupper($this->name ?? ''), 'WAKIL REKTOR')
            || str_contains(strtoupper($this->username ?? ''), 'WAKIL_REKTOR')
            || str_contains(strtoupper($this->role ?? ''), 'WAKIL REKTOR');

        if (!$isWarek && $this->fakultas_unit) {
            $u = DB::table('v_fakultas_unit')->where('id', $this->fakultas_unit)->first();
            if ($u && str_contains(strtoupper($u->nama_fak_prod_unit ?? ''), 'WAKIL REKTOR')) {
                $isWarek = true;
            }
        }

        if (in_array($this->role, ['LPM', 'ADMIN'])) {
            return DB::table('v_fakultas_unit')
                ->where(function($w) {
                    $w->whereNull('is_active')->orWhere('is_active', 1);
                })
                ->pluck('id')
                ->toArray();
        }

        if ($isWarek) {
            $facIds = DB::table('v_fakultas_unit')
                ->where(function($w) {
                    $w->whereNull('is_active')->orWhere('is_active', 1);
                })
                ->where('standalone', 1)
                ->pluck('id')
                ->toArray();
            if ($this->fakultas_unit && !in_array($this->fakultas_unit, $facIds)) {
                $facIds[] = (int)$this->fakultas_unit;
            }
            return array_values(array_unique($facIds));
        }

        if (!$this->fakultas_unit) {
            return [];
        }

        if ($this->role === 'FAKULTAS') {
            $faculty = DB::table('v_fakultas_unit')->where('id', $this->fakultas_unit)->first();
            if ($faculty) {
                return DB::table('v_fakultas_unit')
                    ->where(function($w) {
                        $w->whereNull('is_active')->orWhere('is_active', 1);
                    })
                    ->where(function($q) use ($faculty) {
                        $q->where('id', $this->fakultas_unit)
                          ->orWhere('fakultas', $faculty->nama_fak_prod_unit);
                    })
                    ->pluck('id')
                    ->toArray();
            }
        }

        return [$this->fakultas_unit];
    }
}
