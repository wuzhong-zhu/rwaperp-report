'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const BASE = 'https://data-api.orderly.network/orderly/api/v1/';
  const BROKER = 'rwaperp_xyz';
  const DAY = 86400000;
  let records = [], selection = null;
  const fmt = n => n == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
  const compact = n => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const num = v => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const date = ms => new Date(ms).toISOString().slice(0, 10);
  const utc = s => Date.parse(s + 'T00:00:00Z');
  function preset() {
    if ($('range').value === 'custom') return;
    const end = utc(date(Date.now())) - DAY;
    $('end').value = date(end); $('start').value = date(end - (Number($('range').value) - 1) * DAY);
  }
  function card(label, value, note) {
    const el = document.createElement('div'); el.className = 'card';
    for (const [tag, cls, content] of [['div','label',label],['div','value',value],['small','',note]]) {
      const child = document.createElement(tag); child.className = cls; child.textContent = content; el.append(child);
    }
    return el;
  }
  async function fetchJSON(path) {
    const c = new AbortController(); const timeout = setTimeout(() => c.abort(), 25000);
    try {
      const r = await fetch(path.startsWith('https://') ? path : BASE + path, { signal: c.signal, credentials: 'omit' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const json = await r.json();
      if (json.success === false) throw new Error(json.message || '接口返回失败');
      return json;
    } finally { clearTimeout(timeout); }
  }
  function series(result, md = false) {
    if (result.status !== 'fulfilled') return null;
    const rows = md ? result.value : result.value.rows;
    if (!Array.isArray(rows)) throw new Error('接口 rows 格式异常');
    const map = new Map();
    for (const row of rows) {
      if ((!md || row.broker_id != null) && row.broker_id !== BROKER) continue;
      const d = String(row.date).slice(0, 10);
      if (map.has(d)) throw new Error('接口返回重复日期：' + d);
      map.set(d, row);
    }
    return map;
  }
  function summarize(key) {
    const values = records.map(r => r[key]).filter(v => v != null);
    return { total: values.length ? values.reduce((a,b) => a+b,0) : null, count: values.length };
  }
  function svgNode(tag, attrs = {}, text) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
    if (text != null) el.textContent = text; return el;
  }
  function chart(id, lines, suffix = ' USD', bars = false, stacked = false) {
    const root = $(id); root.replaceChildren();
    const values = lines.flatMap(l => records.map(r => r[l.key])).filter(v => v != null);
    if (!values.length) { const el = document.createElement('div'); el.className='empty'; el.textContent='所选日期无可用数据，请更换日期或点击刷新；接口错误见页面顶部'; root.append(el); return; }
    const W=560,H=240,L=62,R=18,T=22,B=36;
    let min=Math.min(0,...values),max=Math.max(0,...values); if(min===max)max=min+1;
    if(bars){const extent=Math.max(Math.abs(min),Math.abs(max),1);min=-extent;max=extent;}
    if(stacked){min=0;max=100;}
    const x=i=>L+(W-L-R)*(records.length===1?.5:i/(records.length-1));
    const y=v=>T+(H-T-B)*(max-v)/(max-min);
    const svg=svgNode('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':root.parentElement.querySelector('h2').textContent});
    for(let i=0;i<5;i++) { const v=min+(max-min)*i/4; svg.append(svgNode('line',{x1:L,x2:W-R,y1:y(v),y2:y(v),stroke:'#263240'}),svgNode('text',{x:L-9,y:y(v)+4,fill:'#8b9bac','font-size':11,'text-anchor':'end'},stacked?fmt(v)+'%':compact(v))); }
    const indices=[...new Set([0,Math.floor((records.length-1)/2),records.length-1])];
    for(const i of indices)svg.append(svgNode('text',{x:x(i),y:bars?y(0)+15:H-10,fill:'#8b9bac','font-size':11,'text-anchor':'middle'},records[i].date.slice(5)));
    if(bars) svg.append(svgNode('line',{x1:L,x2:W-R,y1:y(0),y2:y(0),stroke:'#8b9bac','stroke-width':1}));
    if(stacked){
      const width=Math.min(28,(W-L-R)/Math.max(records.length,2)*.72);
      records.forEach((r,i)=>{
        if(lines.some(line=>r[line.key]==null))return;
        let base=0;
        for(const line of lines){const value=r[line.key];const top=base+value;
          const rect=svgNode('rect',{x:x(i)-width/2,y:y(top),width,height:Math.max(0,y(base)-y(top)),fill:line.color});
          rect.append(svgNode('title',{},`${r.date} · ${line.name}: ${fmt(value)}%`));svg.append(rect);base=top;
        }
      });
    }
    for(const line of lines) {
      if(stacked)continue;
      if(bars){
        const width=Math.min(22,(W-L-R)/Math.max(records.length,2)*.65);
        records.forEach((r,i)=>{const v=r[line.key];if(v==null)return;
          const mark=v===0?svgNode('line',{x1:x(i)-width/2,x2:x(i)+width/2,y1:y(0),y2:y(0),stroke:'#8ce6b7','stroke-width':2}):svgNode('rect',{x:x(i)-width/2,y:Math.min(y(v),y(0)),width,height:Math.abs(y(v)-y(0)),fill:v>0?'#8ce6b7':'#ffab95'});
          mark.append(svgNode('title',{},`${r.date} · ${line.name}: ${fmt(v)}${suffix}`));svg.append(mark);
        });
        continue;
      }
      let path='', previous=false;
      records.forEach((r,i)=>{const v=r[line.key];if(v==null){previous=false;return;}path+=(previous?' L':' M')+x(i)+' '+y(v);previous=true;});
      svg.append(svgNode('path',{d:path,fill:'none',stroke:line.color,'stroke-width':2}));
      records.forEach((r,i)=>{const v=r[line.key];if(v==null)return;const dot=svgNode('circle',{cx:x(i),cy:y(v),r:records.length>60?2:3,fill:line.color});dot.append(svgNode('title',{},`${r.date} · ${line.name}: ${fmt(v)}${suffix}`));svg.append(dot);});
    }
    const guide=svgNode('line',{y1:T,y2:H-B,stroke:'#afc0d0','stroke-dasharray':'4 4',visibility:'hidden'});svg.append(guide);
    const tip=document.createElement('div');tip.className='tooltip';tip.hidden=true;tip.setAttribute('role','status');
    let selected=0;
    const show=i=>{selected=Math.max(0,Math.min(records.length-1,i));const r=records[selected];tip.textContent=r.date+' UTC\n'+lines.map(l=>l.name+': '+(r[l.key]==null?'缺失':fmt(r[l.key])+(l.unit??suffix))).join('\n');tip.hidden=false;guide.setAttribute('x1',x(selected));guide.setAttribute('x2',x(selected));guide.setAttribute('visibility','visible');const width=root.clientWidth||560;tip.style.left=Math.max(0,Math.min(width-tip.offsetWidth-8,x(selected)/W*width+10))+'px';tip.style.top='10px';};
    const hide=()=>{tip.hidden=true;guide.setAttribute('visibility','hidden');};
    svg.setAttribute('tabindex','0');
    svg.addEventListener('pointermove',e=>{const rect=svg.getBoundingClientRect();if(!rect.width)return;const px=(e.clientX-rect.left)/rect.width*W;show(Math.round((px-L)/(W-L-R)*(records.length-1)));});
    svg.addEventListener('pointerdown',e=>{const rect=svg.getBoundingClientRect();if(rect.width)show(Math.round(((e.clientX-rect.left)/rect.width*W-L)/(W-L-R)*(records.length-1)));});
    svg.addEventListener('pointerleave',hide);svg.addEventListener('blur',hide);svg.addEventListener('focus',()=>show(selected));
    svg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(selected+(e.key==='ArrowRight'?1:-1));}if(e.key==='Escape')hide();});
    root.append(svg,tip);
  }
  function render() {
    const cards=[['总成交量','volume'],['累计充值','deposits'],['累计提现','withdrawals'],['累计净流入','net']];
    $('totals').replaceChildren(...cards.map(([label,key])=>{const s=summarize(key);return card(label+' · USD',fmt(s.total),s.count===records.length?`${s.count} 天 · 所选周期`:`仅 ${s.count}/${records.length} 天有值 · 非完整周期总额`);}));
    chart('volume',[{key:'taker',name:'Taker',color:'#8ce6b7'},{key:'maker',name:'Maker',color:'#7a9aff'}]);
    chart('active',[{key:'active',name:'活跃账户',color:'#7a9aff'}],' 个账户');
    records.forEach(r=>{r.outflow=r.withdrawals==null?null:-Math.abs(r.withdrawals);if(r.net==null&&r.deposits!=null&&r.withdrawals!=null)r.net=r.deposits-Math.abs(r.withdrawals);});
    chart('flows',[{key:'deposits',name:'充值',color:'#8ce6b7'},{key:'outflow',name:'提现（流出）',color:'#ffab95'}],' USD',true);
    chart('daily-net',[{key:'net',name:'每日净流入',color:'#8ce6b7'}],' USD',true);
    const rwa=summarize('rwaVolume'), md=summarize('mdVolume');
    const completeRwa=records.every(r=>r.rwaShare!=null);
    $('rwa-totals').replaceChildren(card('RWA 成交量 · 来源计价',fmt(rwa.total),`${rwa.count}/${records.length} 天有值 · USDC 口径待确认`),card('RWA 周期成交占比',completeRwa&&md.total>0?fmt(rwa.total/md.total*100)+'%':'—','按同源周期成交量计算；缺失时不计算'));
    chart('rwa-volume',[{key:'rwaVolume',name:'RWA',color:'#8ce6b7'},{key:'nonRwaVolume',name:'非 RWA',color:'#7a9aff'}],'（来源计价）');
    records.forEach(r=>{r.nonRwaShare=r.rwaShare==null?null:100-r.rwaShare;});
    chart('rwa-share',[{key:'rwaShare',name:'RWA资产',color:'#8ce6b7'},{key:'nonRwaShare',name:'非RWA资产',color:'#7a9aff'}],'%',false,true);
    chart('rwa-active',[{key:'rwaActive',name:'RWA资产活跃账户',color:'#8ce6b7'},{key:'mdActive',name:'总活跃账户',color:'#7a9aff'}],' 个账户');
    chart('fees',[{key:'dataFee',name:'每日费用',color:'#8ce6b7',unit:' USD'}]);
    $('rows').replaceChildren(...[...records].reverse().map(r=>{const tr=document.createElement('tr');for(const k of ['date','taker','maker','volume','active','deposits','withdrawals','net','mdVolume','rwaVolume','nonRwaVolume','rwaShare','rwaActive','dataFee']){const td=document.createElement('td');td.textContent=k==='date'?r[k]:fmt(r[k]);if(k==='net'&&r[k]!=null)td.className=r[k]>=0?'positive':'negative';tr.append(td);}return tr;}));
    $('export').disabled=!records.some(r=>r.volume!=null||r.net!=null||r.active!=null);
  }
  async function load(e) {
    e?.preventDefault();
    const start=$('start').value,end=$('end').value;
    if(!Number.isFinite(utc(start))||!Number.isFinite(utc(end))||start>end||utc(end)-utc(start)>365*DAY||end>date(Date.now())){
      $('status').textContent='请选择有效日期：开始不晚于结束、最多 366 天、结束不晚于今天。';$('status').className='status error';return;
    }
    $('loading-overlay').hidden=false;
    document.querySelector('main').setAttribute('aria-busy','true');
    document.querySelector('main').setAttribute('inert','');
    selection={start,end};records=[];$('rows').replaceChildren();$('totals').replaceChildren();$('users').replaceChildren();
    for(const id of ['volume','active','flows','daily-net','rwa-volume','rwa-share','rwa-active','fees'])$(id).textContent='加载中…';
    $('status').textContent='正在读取成交、资金与用户数据…';$('status').className='status';$('export').disabled=true;
    for(const id of ['load','range','start','end'])$(id).disabled=true;
    $('rwa-totals').replaceChildren();$('oi-summary').replaceChildren();$('oi-rows').replaceChildren();$('oi-status').textContent='加载中…';
    $('market-oi-rows').replaceChildren();$('market-oi-status').textContent='加载中…';
    const q=new URLSearchParams({broker_id:BROKER,start_date:start,end_date:end});
    try {
      const results=await Promise.allSettled([fetchJSON('dashboard/orderly/by-broker?'+q),fetchJSON('dashboard/fund-flows/by-broker?'+q),fetchJSON('metrics/dex-users'),fetchJSON('https://api.orderly.org/md/volume/builder/daily_stats?broker_id='+BROKER),fetchJSON('https://api.orderly.org/md/volume/builder/daily_stats?broker_id='+BROKER+'&market=RWA'),fetchJSON('https://api.orderly.org/md/cmc/contracts?broker_id='+BROKER),fetchJSON('https://api.orderly.org/md/coingecko/contracts')]);
      const errors=[];let trading=null,flows=null;
      for(const [i,name] of [[0,'成交'],[1,'资金']]){
        try {const map=series(results[i]);if(results[i].status==='rejected')throw results[i].reason;if(i===0)trading=map;else flows=map;}catch(err){errors.push(name+'：'+err.message);}
      }
      let md=null,rwa=null;
      for(const [i,name] of [[3,'MD 总体'],[4,'MD RWA']]){try{if(results[i].status==='rejected')throw results[i].reason;const map=series(results[i],true);if(i===3)md=map;else rwa=map;}catch(err){errors.push(name+'：'+err.message);}}
      const market=results[6];
      const nonnegative=v=>{const n=num(v);return n!=null&&n>=0?n:null;};
      const precise=v=>v==null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:8}).format(v);
      if(market.status==='fulfilled'&&Array.isArray(market.value)&&market.value.length){
        const rows=[...market.value].sort((a,b)=>(nonnegative(b.open_interest_usd)??-1)-(nonnegative(a.open_interest_usd)??-1));
        $('market-oi-status').textContent=`当前市场快照 · ${rows.length} 个合约 · 获取于 ${new Date().toISOString()}`;
        $('market-oi-rows').replaceChildren(...rows.map(r=>{
          const tr=document.createElement('tr');
          for(const v of [r.ticker_id??'—',precise(nonnegative(r.open_interest)),fmt(nonnegative(r.open_interest_usd))]){
            const td=document.createElement('td');td.textContent=v;tr.append(td);
          }
          return tr;
        }));
      }else{
        $('market-oi-status').textContent='CoinGecko 市场 OI不可用，请稍后重试。';
        errors.push('CoinGecko 市场 OI加载失败或无记录');
      }
      const oi=results[5];
      if(oi.status==='fulfilled'&&Array.isArray(oi.value)&&oi.value.length){
        const data=oi.value,valid=data.every(r=>num(r.open_interest_usd)!=null&&num(r.open_interest)!=null&&num(r.open_interest_usd)>=0);
        const total=valid?data.reduce((sum,r)=>sum+num(r.open_interest_usd),0):null;
        $('oi-status').textContent=total===0?'接口所有 OI 为零：可能是缓存缺失，真实持仓待核实。':total==null?'响应字段不完整，无法计算持仓合计。':'当前缓存快照 · 指数价格估值 · 全仓 / 逐仓覆盖待确认 · 不随日期筛选';
        if(total>0)$('oi-summary').append(card('CMC 持仓名义敞口 · USD',fmt(total),'多空绝对值合计，非单边 OI；数据完整性待核实'));
        $('oi-rows').replaceChildren(...data.filter(r=>num(r.open_interest_usd)>0).sort((a,b)=>b.open_interest_usd-a.open_interest_usd).map(r=>{const tr=document.createElement('tr');for(const v of [r.ticker_id,fmt(num(r.open_interest)),fmt(num(r.open_interest_usd))]){const td=document.createElement('td');td.textContent=v;tr.append(td);}return tr;}));
      }else{$('oi-status').textContent='CMC 持仓数据不可用，请稍后重试。';errors.push('CMC 持仓加载失败或无记录');}
      for(let t=utc(start);t<=utc(end);t+=DAY){const d=date(t),a=trading?.get(d),b=flows?.get(d);records.push({date:d,taker:num(a?.taker_volume),maker:num(a?.maker_volume),volume:num(a?.total_volume),active:num(a?.active_users),deposits:num(b?.deposits_usd),withdrawals:num(b?.withdrawals_usd),net:num(b?.net_flow_usd)});}
      const sumVolume=r=>r&&num(r.makerVolume)!=null&&num(r.takerVolume)!=null?num(r.makerVolume)+num(r.takerVolume):null;
      for(const r of records){const a=md?.get(r.date),b=rwa?.get(r.date);r.mdVolume=sumVolume(a);r.rwaVolume=sumVolume(b);const valid=r.mdVolume!=null&&r.rwaVolume!=null&&r.rwaVolume>=0&&r.mdVolume>=r.rwaVolume;r.nonRwaVolume=valid?r.mdVolume-r.rwaVolume:null;r.rwaShare=valid&&r.mdVolume>0?r.rwaVolume/r.mdVolume*100:null;r.mdActive=num(a?.activeUser);r.rwaActive=num(b?.activeUser);r.dataFee=num(trading?.get(r.date)?.broker_fee_usd);}
      if(records.some(r=>r.mdVolume!=null&&r.rwaVolume!=null&&r.rwaVolume>r.mdVolume))errors.push('部分日期 RWA 大于总体，差额与占比已留空');
      let u=null;
      if(results[2].status==='fulfilled'&&Array.isArray(results[2].value.data))u=results[2].value.data.find(r=>r.broker_id===BROKER);
      if(!u)errors.push('用户快照：未取得目标 broker 数据');
      $('users').replaceChildren(...[['日活跃账户','dau','dau_date'],['周活跃账户','wau','wau_end_date'],['月活跃账户','mau','mau_end_date'],['总用户','total_users',null],['新增用户 · 今日','new_users_today',null],['新增用户 · 7 日','new_users_7d',null],['新增用户 · 30 日','new_users_30d',null]].map(([label,key,time])=>card(label,fmt(num(u?.[key])),time&&u?.[time]?`截至 ${u[time]} UTC`:'接口最新快照 · 统计定义待确认')));
      $('snapshot-time').textContent='独立于所选日期 · 数据以各卡片日期为准';
      render();
      const missing=records.filter(r=>r.volume==null||r.net==null).length;
      $('status').textContent=`${start} → ${end} UTC · 加载于 ${new Date().toISOString().replace('T',' ').slice(0,19)} UTC`+(missing?` · ${missing} 天成交或资金数据缺失`:'')+(errors.length?' · '+errors.join('；')+'。网络错误请检查 CORS / 连接后重试。':'')+(end===date(Date.now())?' · 当日数据可能尚未完成':'');
      $('status').className=errors.length?'status error':'status';
    } catch(error) {
      $('status').textContent='报表绘制失败：'+error.message+'。请刷新重试。';
      $('status').className='status error';
    } finally {
      $('loading-overlay').hidden=true;
      document.querySelector('main').setAttribute('aria-busy','false');
      document.querySelector('main').removeAttribute('inert');
      for(const id of ['load','range','start','end'])$(id).disabled=false;
    }
  }
  $('filters').addEventListener('submit',load);
  $('range').addEventListener('change',preset);
  for(const id of ['start','end'])$(id).addEventListener('change',()=>{$('range').value='custom';});
  $('export').addEventListener('click',()=>{
    const keys=['date','taker','maker','volume','active','deposits','withdrawals','net','mdVolume','rwaVolume','nonRwaVolume','rwaShare','rwaActive','dataFee'];
    const lines=[['broker_id','date_utc','taker_volume','maker_volume','total_volume','active_accounts','deposits_usd','withdrawals_usd','net_flow_usd','md_total_volume_source_unit','rwa_volume_source_unit','non_rwa_volume_source_unit','rwa_share_pct','rwa_active_accounts','data_broker_fee_usd'].join(','),...records.map(r=>[BROKER,...keys.map(k=>r[k]??'')].join(','))];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`rwaperp-${selection.start}-${selection.end}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  preset();load();
})();
