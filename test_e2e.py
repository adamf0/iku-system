import urllib.request, json, urllib.parse

BASE = "http://localhost:4000/api"

def call(method, path, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def login(u, p):
    s, d = call("POST", "/auth/login", body={"username": u, "password": p})
    assert s == 200, d
    return d["token"]

print("== Health ==")
print(call("GET", "/health"))

print("\n== Login admin ==")
tok_admin = login("admin", "admin123")
print("OK, role check:", call("GET", "/auth/me", tok_admin)[1]["role"])

print("\n== Master IKU count ==")
s, d = call("GET", "/master/iku", tok_admin)
print("status", s, "count", len(d))

print("\n== Dashboard summary (admin) ==")
s, d = call("GET", "/dashboard/summary?tahun=2026", tok_admin)
print("unit_terpantau", d["total_unit_terpantau"], "| iku_dipantau", d["total_iku_dipantau"],
      "| total_laporan", d["total_laporan"], "| status", d["status_count"], "| persen_tercapai", d["persentase_iku_tercapai"])

print("\n== Login prodi_ti, check scope isolation ==")
tok_prodi = login("prodi_ti", "prodi123")
s, d = call("GET", "/capaian?tahun=2026", tok_prodi)
units_seen = set(r["kode_unit"] for r in d)
print("rows:", len(d), "units seen (should be only FT-TI):", units_seen)
assert units_seen <= {"FT-TI"}, "SCOPE LEAK!"

print("\n== Try access other unit (should be 403) ==")
s, d = call("POST", "/capaian", tok_prodi, {
    "kode_iku": "IKU 1", "kode_unit": "FT-TS", "tahun": 2026, "triwulan": "TW4",
    "nilai_pembilang": 10, "nilai_penyebut": 20, "target_capaian": 75
})
print("status (expect 403):", s, d)
assert s == 403

print("\n== Full workflow: create -> submit -> verify -> sahkan ==")
s, created = call("POST", "/capaian", tok_prodi, {
    "kode_iku": "IKU 1", "kode_unit": "FT-TI", "tahun": 2026, "triwulan": "TW4",
    "nilai_pembilang": 40, "nilai_penyebut": 50, "target_capaian": 75, "catatan": "tes e2e"
})
print("create status", s, created)
assert s in (200, 201), created
cid = created["id_capaian"]

s, d = call("POST", f"/capaian/{cid}/submit", tok_prodi)
print("submit:", s, d)
assert s == 200

# prodi cannot verify
s, d = call("POST", f"/capaian/{cid}/verify", tok_prodi, {"action": "APPROVE"})
print("prodi tries verify (expect 403):", s, d)
assert s == 403

tok_lpm = login("lpm", "lpm123")
s, d = call("POST", f"/capaian/{cid}/verify", tok_lpm, {"action": "APPROVE"})
print("lpm verify:", s, d)
assert s == 200

s, d = call("POST", f"/capaian/{cid}/sahkan", tok_lpm)
print("lpm sahkan:", s, d)
assert s == 200

s, detail = call("GET", f"/capaian/{cid}", tok_lpm)
print("final detail status:", detail["status_validasi"], "capaian:", detail["nilai_capaian"])
assert detail["status_validasi"] == "DISAHKAN"
assert detail["nilai_capaian"] == 80.0

print("\n== Reject flow ==")
s, created2 = call("POST", "/capaian", tok_prodi, {
    "kode_iku": "IKU 2", "kode_unit": "FT-TI", "tahun": 2026, "triwulan": "TW4",
    "nilai_pembilang": 5, "nilai_penyebut": 100, "target_capaian": 85
})
cid2 = created2["id_capaian"]
call("POST", f"/capaian/{cid2}/submit", tok_prodi)
s, d = call("POST", f"/capaian/{cid2}/verify", tok_lpm, {"action": "REJECT", "catatan": "Bukti dukung tracer study belum lengkap"})
print("reject:", s, d)
s, detail2 = call("GET", f"/capaian/{cid2}", tok_prodi)
print("status after reject:", detail2["status_validasi"], "| alasan:", detail2["alasan_penolakan"])
assert detail2["status_validasi"] == "DITOLAK"

print("\n== FAKULTAS scope (should see FT + all prodi under FT) ==")
tok_fak = login("fakultas_ft", "fakultas123")
s, d = call("GET", "/capaian?tahun=2026", tok_fak)
units_seen_fak = set(r["kode_unit"] for r in d)
print("units seen by fakultas_ft:", units_seen_fak)

print("\n== Dashboard trend & rekap-matriks ==")
s, trend = call("GET", "/dashboard/trend/" + urllib.parse.quote("IKU 1") + "?tahun=2026", tok_admin)
print("trend status", s, trend)

s, rekap = call("GET", "/dashboard/rekap-matriks?tahun=2026&triwulan=TW4", tok_admin)
print("rekap-matriks status", s, "units:", len(rekap["matriks"]), "iku cols:", len(rekap["iku_columns"]))

print("\n== Antrean verifikasi (LPM) ==")
s, ant = call("GET", "/dashboard/antrean-verifikasi", tok_lpm)
print("antrean count:", len(ant))

print("\nALL TESTS PASSED")
