#!/usr/bin/env bash
# Läuft auf dem Live-VPS (via SSH). Zwei parallele Service-Role-Clients
# prüfen Live-Signal und CAS-Konflikt — ohne Gast-sichtbare Daten.
set -euo pipefail

cid=$(docker ps --format '{{.Names}}' | grep d3cg1b54arvue2tcm8u34qty- | head -1)
if [[ -z "${cid}" ]]; then
  echo "app container not found" >&2
  exit 1
fi
echo "container=${cid}"

docker exec "$cid" node -e '
const base=(process.env.SUPABASE_UPSTREAM_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/$/,"");
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
if(!base||!key){console.error("missing env"); process.exit(1);}
const rid="fcc50bb3-130d-476b-94dc-3c7392b773a8";
const h={apikey:key,Authorization:"Bearer "+key,Accept:"application/json","Content-Type":"application/json","Prefer":"return=representation"};
const rpc=(name,body)=>fetch(base+"/rest/v1/rpc/"+name,{method:"POST",headers:h,body:JSON.stringify(body||{})});
const rest=(path)=>fetch(base+"/rest/v1/"+path,{headers:h});
function parseJson(text){ try { return JSON.parse(text); } catch { return text; } }

(async()=>{
  const tables=["menu_items","restaurant_staff_scheduled_shifts","contacts","inventory_purchase_orders"];
  for (const table of tables) {
    const res=await rest(table+"?restaurant_id=eq."+rid+"&select=id&limit=1");
    console.log("table", table, res.status);
    if(!res.ok){ console.error("table_probe_failed", table); process.exit(1); }
  }

  const signalBefore=await (await rest("restaurant_inventory_live_signals?restaurant_id=eq."+rid+"&select=revision,updated_at")).json();
  console.log("signal_before", JSON.stringify(signalBefore));

  const [a,b]=await Promise.all([
    rpc("bump_restaurant_inventory_live_signal_once",{p_restaurant_id:rid}),
    rpc("bump_restaurant_inventory_live_signal_once",{p_restaurant_id:rid}),
  ]);
  console.log("bump_a", a.status);
  console.log("bump_b", b.status);
  if(!a.ok || !b.ok){
    console.error("live signal bump failed");
    process.exit(1);
  }

  const signalAfter=await (await rest("restaurant_inventory_live_signals?restaurant_id=eq."+rid+"&select=revision,updated_at")).json();
  console.log("signal_after", JSON.stringify(signalAfter));
  const beforeRev=Number(signalBefore?.[0]?.revision||0);
  const afterRev=Number(signalAfter?.[0]?.revision||0);
  if(!(afterRev>beforeRev)){
    console.error("revision did not increase");
    process.exit(1);
  }

  const touch=await rpc("platform_live_sync_probe_touch",{p_probe_key:"deploy_two_client"});
  if(touch.status===404){
    console.log("cas_probe skipped (rpc not deployed yet)");
    console.log("two_client_partial_ok", JSON.stringify({beforeRev,afterRev}));
    process.exit(0);
  }
  if(!touch.ok){
    console.log("cas_probe_touch", touch.status, (await touch.text()).slice(0,300));
    process.exit(1);
  }
  const touched=await touch.json();
  const expected=touched.updated_at;
  console.log("cas_touch", JSON.stringify(touched));

  const [ca,cb]=await Promise.all([
    rpc("platform_live_sync_probe_cas",{p_probe_key:"deploy_two_client",p_expected_updated_at:expected,p_payload:{client:"a"}}),
    rpc("platform_live_sync_probe_cas",{p_probe_key:"deploy_two_client",p_expected_updated_at:expected,p_payload:{client:"b"}}),
  ]);
  const ja=parseJson(await ca.text());
  const jb=parseJson(await cb.text());
  console.log("cas_a", ca.status, JSON.stringify(ja));
  console.log("cas_b", cb.status, JSON.stringify(jb));
  const wins=[ja,jb].filter((x)=>x && x.ok===true && x.conflict===false).length;
  const conflicts=[ja,jb].filter((x)=>x && x.conflict===true).length;
  if(wins!==1 || conflicts!==1){
    console.error("expected exactly one CAS winner and one conflict");
    process.exit(1);
  }
  console.log("two_client_ok", JSON.stringify({beforeRev,afterRev,wins,conflicts}));
})().catch((e)=>{console.error(e); process.exit(1);});
'
