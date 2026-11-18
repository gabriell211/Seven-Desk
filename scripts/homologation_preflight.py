#!/usr/bin/env python3
"""Seven Desk read-only HTTP preflight; never creates accounts or remote sessions."""
import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

SITE="https://www.sevendesk.tech"
DOWNLOADS="https://downloads.sevendesk.tech"
SHA=re.compile(r"^[a-f0-9]{40}$")
VERSION=re.compile(r"^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9]+)?$")
ASSET=re.compile(r"^sevendesk-[A-Za-z0-9._-]{1,180}$")
REQUIRED={
 "win_x64":r"^sevendesk-.*-x86_64\.exe$",
 "win_arm64":r"^sevendesk-.*-aarch64\.exe$",
 "mac_x64":r"^sevendesk-.*-x86_64\.dmg$",
 "mac_arm64":r"^sevendesk-.*-aarch64\.dmg$",
 "linux_x64":r"^sevendesk-.*-x86_64\.AppImage$",
 "linux_arm64":r"^sevendesk-.*-aarch64\.AppImage$",
 "android":r"^sevendesk-.*-(?:aarch64|universal)-signed\.apk$",
}
MANUAL_CASES=(
 "WIN_PORTABLE","WIN_ACCEPT","WIN_REJECT","WIN_UAC_ALLOW","WIN_UAC_DENY",
 "WIN_PANEL","WIN_MONITOR","WIN_CHAT_TRANSFER","WIN_REVOKE","WIN_ALIAS",
 "WIN_OFFLINE","WIN_UNATTENDED","LINUX_APPIMAGE","LINUX_CONSENT",
 "MAC_DMG","MAC_CONSENT","ANDROID_CONSENT","ACCOUNT_PF_PJ",
 "ACCOUNT_FIVE_SLOTS","ACCOUNT_TECH_CLAIM","PAYMENT_SANDBOX","IDENTITY_AUTH",
 "LEGACY_INSTALLERS_DENIED","LATEST_INSTALLERS_CONNECTED","SERVER_IDENTITY_CUTOVER",
)

@dataclass(frozen=True)
class Response:
 status:int
 body:bytes=b""
 headers:dict|None=None

class StopRedirect(HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  return None

def fetch(url,method="GET",follow=True):
 opener=build_opener() if follow else build_opener(StopRedirect)
 req=Request(url,method=method,headers={"User-Agent":"SevenDeskHomologation/1.0"})
 try:
  with opener.open(req,timeout=12) as res:
   return Response(res.status,res.read(1048576) if method=="GET" else b"",
     {k.lower():v for k,v in res.headers.items()})
 except HTTPError as err:
  with err:
   return Response(err.code,err.read(4096) if method=="GET" else b"",
     {k.lower():v for k,v in err.headers.items()})

def validate_origin(url):
 p=urlsplit(url)
 if p.scheme!="https" or not p.hostname or p.username or p.password or p.path not in ("","/") or p.query or p.fragment:
  raise ValueError("Only plain HTTPS origins without credentials are allowed")
 return url.rstrip("/")

def status(checks):
 values={x["status"] for x in checks}
 return "FAIL" if "FAIL" in values else "BLOCKED" if "BLOCKED" in values else "PASS"

def add(checks,id,state,detail):
 checks.append({"id":id,"status":state,"detail":detail})

def preflight(site=SITE,downloads=DOWNLOADS,client=fetch,commit=None):
 checks=[]
 def visit(id,url,expected,method="GET",follow=True):
  try:
   r=client(url,method,follow)
   add(checks,id,"PASS" if r.status in expected else "FAIL",
       "HTTP "+str(r.status))
   return r
  except Exception as exc:
   add(checks,id,"FAIL","Request or TLS failed: "+type(exc).__name__)
   return None
 visit("site_tls",site+"/",(200,))
 flags=visit("account_availability",site+"/api/account-availability",(200,))
 if flags and flags.status==200:
  try:
   obj=json.loads(flags.body)
   assert all(type(obj.get(k)) is bool for k in
     ("loginEnabled","registrationEnabled","recoveryEnabled"))
   add(checks,"account_schema","PASS","Boolean feature flags")
  except (ValueError,TypeError,AssertionError):
   add(checks,"account_schema","FAIL","Unexpected account flags JSON")
 for name in ("/.env","/server.js","/lib/db-pool.js"):
  visit("private_"+name.rsplit("/",1)[-1],site+name,(403,404))
 visit("profile_requires_auth",site+"/api/app-profile",(401,403))
 redirect=visit("http_redirect","http://"+urlsplit(downloads).netloc+"/",(301,308),follow=False)
 if redirect and redirect.status in (301,308):
  url=(redirect.headers or {}).get("location")
  add(checks,"redirect_target","PASS" if url==downloads+"/" else "FAIL",
      "HTTPS target verified" if url==downloads+"/" else "Unexpected redirect")
 visit("downloads_hidden",downloads+"/.env",(403,404))
 response=visit("manifest_http",downloads+"/manifest.json",(200,404))
 if response and response.status==404:
  add(checks,"release_published","BLOCKED","No published release")
 if response and response.status==200:
  try:
   data=json.loads(response.body)
   if not (isinstance(data,dict) and isinstance(data.get("version"),str) and
       VERSION.fullmatch(data["version"]) and isinstance(data.get("source_commit"),str) and
       SHA.fullmatch(data["source_commit"]) and type(data.get("build_run_id")) is int and
       data["build_run_id"]>0 and isinstance(data.get("files"),list) and data["files"]):
    raise ValueError("Invalid manifest metadata")
   if commit and data["source_commit"]!=commit:
    raise ValueError("Manifest source does not match inspected commit")
   files={}
   for entry in data["files"]:
    if not (isinstance(entry,dict) and isinstance(entry.get("name"),str) and
        ASSET.fullmatch(entry["name"]) and entry["name"] not in files and
        type(entry.get("size")) is int and entry["size"]>0 and
        isinstance(entry.get("sha256"),str) and
        re.fullmatch(r"[a-f0-9]{64}",entry["sha256"])):
     raise ValueError("Invalid release file")
    files[entry["name"]]=entry
   add(checks,"manifest_integrity","PASS","Valid metadata and SHA-256 entries")
   for key,pattern in REQUIRED.items():
    candidates=[entry for name,entry in files.items() if re.fullmatch(pattern,name)]
    if not candidates:
     add(checks,"asset_"+key,"BLOCKED","Portable asset missing")
     continue
    entry=candidates[0]
    head=visit("asset_"+key,downloads+"/"+data["version"]+"/"+entry["name"],(200,),method="HEAD")
    if head and head.status==200:
     length=(head.headers or {}).get("content-length")
     add(checks,"size_"+key,"PASS" if length==str(entry["size"]) else "FAIL",
         "Expected Content-Length" if length==str(entry["size"]) else "Size mismatch")
  except (TypeError,ValueError,KeyError):
   add(checks,"manifest_integrity","FAIL","Invalid metadata, asset or commit")
 return {"preflight_status":status(checks),"checks":checks}

def evidence_gate(path,commit):
 if path is None:
  return {"status":"BLOCKED","reason":"Physical tests and tester evidence are not supplied"}
 if not commit or not SHA.fullmatch(commit):
  return {"status":"FAIL","reason":"A full source commit SHA is required"}
 try:
  doc=json.loads(path.read_text(encoding="utf-8"))
  cases=doc["cases"]
  if (doc.get("commit")!=commit or not isinstance(cases,list) or
      len(cases)!=len(MANUAL_CASES) or
      any(not isinstance(c,dict) for c in cases) or
      {c.get("id") for c in cases}!=set(MANUAL_CASES)):
   raise ValueError("Case identifiers or commit do not match")
  for c in cases:
   if not isinstance(c,dict):
    raise ValueError("Malformed test case")
   if c.get("status") not in ("PASS","FAIL","BLOCKED","PENDING"):
    raise ValueError("Unknown status")
   if c["status"]=="PASS" and not (
     isinstance(c.get("tester"),str) and c["tester"].strip() and
     isinstance(c.get("evidence"),str) and c["evidence"].strip()):
    raise ValueError("PASS without tester/evidence")
  if any(c["status"]=="FAIL" for c in cases):
   return {"status":"FAIL","reason":"Manual case failed"}
  if any(c["status"]!="PASS" for c in cases):
   return {"status":"BLOCKED","reason":"Physical tests pending"}
  return {"status":"PASS","reason":"All physical cases have tester and evidence"}
 except (OSError,ValueError,TypeError,KeyError):
  return {"status":"FAIL","reason":"Invalid manual evidence file"}

def write_report(path,obj):
 path.parent.mkdir(parents=True,exist_ok=True)
 fd,temporary=tempfile.mkstemp(prefix=".homologacao-",dir=path.parent)
 try:
  with os.fdopen(fd,"w",encoding="utf-8") as out:
   json.dump(obj,out,indent=2,ensure_ascii=False)
   out.write("\n")
  os.chmod(temporary,0o600)
  os.replace(temporary,path)
 finally:
  if os.path.exists(temporary):
   os.unlink(temporary)

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument("--site",default=SITE)
 parser.add_argument("--downloads",default=DOWNLOADS)
 parser.add_argument("--commit")
 parser.add_argument("--evidence",type=Path)
 parser.add_argument("--output",type=Path)
 args=parser.parse_args()
 if args.commit and not SHA.fullmatch(args.commit):
  parser.error("Invalid commit SHA")
 try:
  site=validate_origin(args.site)
  downloads=validate_origin(args.downloads)
 except ValueError as err:
  parser.error(str(err))
 result=preflight(site,downloads,commit=args.commit)
 manual=evidence_gate(args.evidence,args.commit)
 gate=status([{"status":result["preflight_status"]},{"status":manual["status"]}])
 report={"timestamp_utc":datetime.now(timezone.utc).isoformat(),
  "source_commit":args.commit,"site":site,"downloads":downloads,
  **result,"manual":manual,"release_gate":gate}
 if args.output:
  write_report(args.output,report)
 print(json.dumps(report,indent=2,ensure_ascii=False))
 return 0 if gate=="PASS" else 2 if gate=="BLOCKED" else 1

if __name__=="__main__":
 raise SystemExit(main())

