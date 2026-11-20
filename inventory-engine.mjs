function localStamp(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hourCycle:'h23'
  }).formatToParts(new Date(instant));
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function datesBetween(startDate,endDate) {
  const out=[];
  for(let d=new Date(`${startDate}T00:00:00Z`),end=new Date(`${endDate}T00:00:00Z`);d<=end;d.setUTCDate(d.getUTCDate()+1)) out.push(d.toISOString().slice(0,10));
  return out;
}
function dailyMinimumAmount(model,rule,date) {
  const planned=model.meals.filter(e=>!e.cancelled && localStamp(e.at,model.timeZone).slice(0,10)===date)
    .reduce((sum,e)=>sum+(e.uses?.[rule.item]||0),0);
  return Math.max(0,rule.quantity-planned);
}
// Pure projection: a meal ID is applied at most once; a count resets its item's baseline.
export function inventoryAt(model, now = new Date()) {
  const instant = new Date(now).getTime();
  const events = [...model.meals, ...(model.adjustments || [])];
  const seen = new Set();
  for (const event of events) {
    if (seen.has(event.id)) throw new Error('Duplicate inventory event: ' + event.id);
    seen.add(event.id);
  }
  return model.items.map(item => {
    let quantity = item.quantity;
    let from = Date.parse(item.asOf);
    const counts = events.filter(e=>e.type==='count' && e.item===item.id && Date.parse(e.at)<=instant).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    if (counts.length) { const c=counts.at(-1); quantity=c.quantity; from=Date.parse(c.at); }
    if (quantity===null) return {...item,remaining:null,used:null,shortfall:null};
    if (!Number.isFinite(quantity) || quantity<0 || !Number.isFinite(from)) throw new Error('Invalid baseline');
    let balance=quantity, used=0;
    for (const e of events) {
      const at=Date.parse(e.at);
      if (!Number.isFinite(at)) throw new Error('Invalid event time');
      if (at<=from || at>instant || e.cancelled) continue;
      if (e.type==='receipt' && e.item===item.id) balance+=e.quantity;
      if (!e.type || e.type==='meal' || e.type==='transfer') {
        const amount=e.uses?.[item.id]||0;
        balance-=amount;used+=amount;
        balance+=e.produces?.[item.id]||0;
      }
    }
    for (const rule of model.dailyMinimumUses || []) {
      if (rule.item!==item.id) continue;
      const fromLocal=localStamp(from,model.timeZone),nowLocal=localStamp(instant,model.timeZone);
      const start=rule.startDate>fromLocal.slice(0,10)?rule.startDate:fromLocal.slice(0,10);
      const end=rule.endDate && rule.endDate<nowLocal.slice(0,10)?rule.endDate:nowLocal.slice(0,10);
      if (start>end) continue;
      for (const date of datesBetween(start,end)) {
        const occurrence=`${date}T${rule.time||'23:59'}`;
        if (occurrence<=fromLocal || occurrence>nowLocal) continue;
        const amount=dailyMinimumAmount(model,rule,date);
        balance-=amount;used+=amount;
      }
    }
    return {...item,remaining:Math.max(0,Math.round(balance*100)/100),used:Math.round(used*100)/100,shortfall:Math.max(0,-balance)};
  });
}
export function needsThrough(model, now, through) {
  const current=inventoryAt(model,now), end=inventoryAt(model,through);
  return end.filter(x=>x.remaining!==null && x.shortfall>0).map(x=>({...x,available:current.find(c=>c.id===x.id).remaining}));
}
