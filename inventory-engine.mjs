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
    return {...item,remaining:Math.max(0,Math.round(balance*100)/100),used:Math.round(used*100)/100,shortfall:Math.max(0,-balance)};
  });
}
export function needsThrough(model, now, through) {
  const current=inventoryAt(model,now), end=inventoryAt(model,through);
  return end.filter(x=>x.remaining!==null && x.shortfall>0).map(x=>({...x,available:current.find(c=>c.id===x.id).remaining}));
}
