"""Offline regressions for preflight; no production mutation."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parent))
import homologation_preflight as h

S=h.SITE
D=h.DOWNLOADS
SHA="a"*40

def manifest():
 names=[
  "sevendesk-1.0-x86_64.exe","sevendesk-1.0-aarch64.exe",
  "sevendesk-1.0-x86_64.dmg","sevendesk-1.0-aarch64.dmg",
  "sevendesk-1.0-x86_64.AppImage","sevendesk-1.0-aarch64.AppImage",
  "sevendesk-1.0-universal-signed.apk"]
 return {"version":"v1.0.0-1","source_commit":SHA,"build_run_id":14,
         "files":[{"name":n,"size":123,"sha256":"b"*64} for n in names]}

def fake(manifest_code=404,body=None,private=404):
 calls=[]
 def client(url,method="GET",follow=True):
  calls.append((url,method))
  if url==S+"/": return h.Response(200)
  if url.endswith("/api/account-availability"):
   return h.Response(200,b'{"loginEnabled":true,"registrationEnabled":true,"recoveryEnabled":true}')
  if url.endswith("/api/app-profile"):return h.Response(401)
  if url.startswith(S): return h.Response(private)
  if url.startswith("http://"):return h.Response(301,headers={"location":D+"/"})
  if url.endswith("/manifest.json"):
   return h.Response(manifest_code,json.dumps(body or {}).encode())
  if url.endswith("/.env"):return h.Response(404)
  if method=="HEAD":return h.Response(200,headers={"content-length":"123"})
  raise AssertionError("Unexpected request "+url)
 return client,calls

class PreflightTest(unittest.TestCase):
 def test_missing_release_is_blocked_not_approved(self):
  client,calls=fake()
  r=h.preflight(client=client)
  self.assertEqual(r["preflight_status"],"BLOCKED")
  self.assertTrue(all(m in ("GET","HEAD") for _,m in calls))
 def test_release_assets_validated_without_downloads(self):
  client,calls=fake(200,manifest())
  r=h.preflight(client=client,commit=SHA)
  self.assertEqual(r["preflight_status"],"PASS")
  self.assertEqual(sum(m=="HEAD" for _,m in calls),7)
 def test_missing_portable_assets_and_unsafe_manifest(self):
  data=manifest()
  data["files"]=[a for a in data["files"] if not a["name"].endswith(".AppImage")]
  self.assertEqual(h.preflight(client=fake(200,data)[0])["preflight_status"],"BLOCKED")
  data["files"].append({"name":"../.env","size":1,"sha256":"b"*64})
  self.assertEqual(h.preflight(client=fake(200,data)[0])["preflight_status"],"FAIL")
 def test_rev_mismatch_and_private_exposure_fail(self):
  self.assertEqual(h.preflight(client=fake(200,manifest())[0],commit="c"*40)["preflight_status"],"FAIL")
  self.assertEqual(h.preflight(client=fake(private=200)[0])["preflight_status"],"FAIL")
 def test_manual_gate_never_passes_without_real_evidence(self):
  self.assertEqual(h.evidence_gate(None,SHA)["status"],"BLOCKED")
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/"evidence.json"
   cases=[{"id":i,"status":"PENDING","tester":"","evidence":""} for i in h.MANUAL_CASES]
   path.write_text(json.dumps({"commit":SHA,"cases":cases}))
   self.assertEqual(h.evidence_gate(path,SHA)["status"],"BLOCKED")
   for c in cases:c.update({"status":"PASS","tester":"QA","evidence":"secure/test.webm"})
   path.write_text(json.dumps({"commit":SHA,"cases":cases}))
   self.assertEqual(h.evidence_gate(path,SHA)["status"],"PASS")
   self.assertEqual(h.evidence_gate(path,"b"*40)["status"],"FAIL")
   cases[0]["evidence"]=""
   path.write_text(json.dumps({"commit":SHA,"cases":cases}))
   self.assertEqual(h.evidence_gate(path,SHA)["status"],"FAIL")
   cases[0]=None
   path.write_text(json.dumps({"commit":SHA,"cases":cases}))
   self.assertEqual(h.evidence_gate(path,SHA)["status"],"FAIL")
 def test_https_origin_restrictions(self):
  self.assertEqual(h.validate_origin(S+"/"),S)
  for url in ("http://host","https://u:p@host","https://host/path","https://host/?key=x"):
   with self.assertRaises(ValueError):h.validate_origin(url)

if __name__=="__main__":unittest.main()

