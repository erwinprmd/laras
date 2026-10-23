"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const el = {file:$('midiFileInput'), title:$('titleInput'), do:$('doSelect'), meter:$('meterSelect'), convert:$('convertButton'), reset:$('resetButton'), status:$('status'), tracksPanel:$('tracksPanel'), trackCount:$('trackCount'), assignments:$('trackAssignments'), apply:$('applyPartsButton'), scorePanel:$('scorePanel'), scoreTitle:$('scoreTitle'), meta:$('scoreMeta'), output:$('scoreOutput'), copy:$('copyButton'), download:$('downloadButton'), print:$('printButton')};
  const PARTS = ['Melodi 1','Melodi 2','Melodi 3','Bass','Perkusi','Tidak digunakan'];
  const PC = {C:0,D:2,E:4,F:5,G:7,A:9,B:11,Bb:10};
  const PC_NAMES = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
  let midiData = null, parsed = null, lastText = '';
  function status(msg, type=''){el.status.textContent=msg;el.status.className='status '+type;}
  function readAscii(bytes, p, n){return String.fromCharCode(...bytes.slice(p,p+n));}
  function parseMidi(buffer){
    const b=new Uint8Array(buffer); let p=0;
    const need=n=>{if(p+n>b.length)throw Error('Berkas MIDI terpotong atau tidak valid.');};
    const u8=()=>{need(1);return b[p++];};
    const u16=()=>((u8()<<8)|u8());
    const u32=()=>((u8()*0x1000000)+(u8()<<16)+(u8()<<8)+u8());
    const ascii=n=>{need(n);const s=readAscii(b,p,n);p+=n;return s;};
    if(ascii(4)!=='MThd')throw Error('Header MThd tidak ditemukan. Pilih berkas Standard MIDI (.mid/.midi).');
    const headerLen=u32(); if(headerLen<6)throw Error('Header MIDI tidak valid.');
    const format=u16(), trackCount=u16(), division=u16(); p+=headerLen-6;
    if(format>1)throw Error('MIDI format 2 belum didukung. Gunakan MIDI format 0 atau 1.');
    if(division&0x8000)throw Error('MIDI berbasis SMPTE belum didukung; gunakan MIDI dengan timing PPQ.');
    if(!division)throw Error('Resolusi timing MIDI tidak valid.');
    const tracks=[]; let tempo=500000, meter={num:4,den:4}, maxTick=0;
    for(let ti=0;ti<trackCount;ti++){
      if(p+8>b.length)break;
      const id=ascii(4), len=u32(); if(id!=='MTrk'){p+=len;continue;} const end=p+len;
      let tick=0,running=0; const events=[], active=new Map(); let name=`Track ${ti+1}`;
      const vlq=()=>{let v=0,c=0;do{c=u8();v=(v<<7)|(c&127);}while(c&128);return v;};
      while(p<end && p<b.length){tick+=vlq();let st=u8();if(st<0x80){p--;st=running;}else if(st<0xf0)running=st;
        if(st===0xff){const type=u8(),n=vlq();need(n);if(type===0x03){name=readAscii(b,p,n)||name;}if(type===0x51&&n===3){tempo=(b[p]<<16)|(b[p+1]<<8)|b[p+2];}if(type===0x58&&n>=2){meter={num:b[p],den:2**b[p+1]};}p+=n;continue;}
        if(st===0xf0||st===0xf7){p+=vlq();continue;}
        const cmd=st&0xf0,ch=st&0x0f; let d1=u8(),d2=0;if(cmd!==0xc0&&cmd!==0xd0)d2=u8();
        if(cmd===0x90&&d2>0){const key=`${ch}:${d1}`;if(!active.has(key))active.set(key,[]);active.get(key).push({tick,pitch:d1,velocity:d2,channel:ch});}
        else if(cmd===0x80||(cmd===0x90&&d2===0)){const key=`${ch}:${d1}`,stack=active.get(key);if(stack&&stack.length){const on=stack.shift();events.push({...on,endTick:Math.max(tick,on.tick+1)});}}
      }
      for(const stack of active.values())for(const on of stack)events.push({...on,endTick:on.tick+Math.max(1,division)});
      events.sort((a,b)=>a.tick-b.tick||a.pitch-b.pitch);maxTick=Math.max(maxTick,...events.map(e=>e.endTick||e.tick));
      tracks.push({index:ti,name,events});p=end;
    }
    if(!tracks.some(t=>t.events.length))throw Error('Tidak ditemukan not MIDI. Pastikan berkas berisi data note-on/note-off.');
    return {format,division,tracks,tempo,meter,maxTick};
  }
  function showTracks(){el.assignments.replaceChildren();const usable=parsed.tracks.filter(t=>t.events.length);el.trackCount.textContent=`${usable.length} track bernada`;
    usable.forEach((track,i)=>{const row=document.createElement('div');row.className='track-row';const info=document.createElement('div');const name=document.createElement('div');name.className='track-name';name.textContent=track.name;const detail=document.createElement('div');detail.className='track-detail';const pitches=track.events.map(e=>e.pitch);detail.textContent=`${track.events.length} not · rentang ${midiName(Math.min(...pitches))}–${midiName(Math.max(...pitches))}`;info.append(name,detail);const label=document.createElement('label');label.textContent='Masukkan ke part';const select=document.createElement('select');select.dataset.track=track.index;select.innerHTML=PARTS.map((p,j)=>`<option value="${j===5?'skip':p}">${p==='Tidak digunakan'?'Tidak digunakan':p}</option>`).join('');select.value=track.name.toLowerCase().includes('bass')?'Bass':track.name.toLowerCase().includes('drum')?'Perkusi':i===0?'Melodi 1':'skip';label.append(select);row.append(info,label);el.assignments.append(row);});
    el.tracksPanel.classList.remove('hidden');el.scorePanel.classList.add('hidden');
  }
  function midiName(n){return `${PC_NAMES[n%12]}${Math.floor(n/12)-1}`;}
  function selectedMeter(){if(el.meter.value!=='auto'){const [num,den]=el.meter.value.split('/').map(Number);return {num,den};}return parsed.meter;}
  function solfa(pitch, tonic){const pc=pitch%12, delta=(pc-tonic+12)%12, major=[0,2,4,5,7,9,11];let best=0,dist=99,acc=0;major.forEach((x,i)=>{let d=((delta-x+6)%12)-6;if(Math.abs(d)<Math.abs(dist)){dist=d;best=i;acc=d;}});let symbol=String(best+1);if(acc===1)symbol='♯'+symbol;else if(acc===-1)symbol='♭'+symbol;else if(acc!==0)symbol=(acc>0?'♯':'♭')+symbol;const tonicMidi=60+tonic;const oct=Math.round((pitch-tonicMidi)/12);if(oct>0)symbol+='^'.repeat(Math.min(oct,3));if(oct<0)symbol+='v'.repeat(Math.min(-oct,3));return {symbol,oct};}
  function durationToken(beats, symbol){let base=symbol;if(beats<0.75)base=`_${base}_`;if(beats>=1.75)base+= '—'.repeat(Math.max(1,Math.round(beats)-1));return base;}
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function buildPart(part, trackAssignments, meter, tonic){
    const selected=parsed.tracks.filter(t=>t.events.length&&trackAssignments.get(t.index)===part);if(!selected.length)return null;
    const events=selected.flatMap(t=>t.events.map(e=>({...e,source:t.name}))).sort((a,b)=>a.tick-b.tick||a.pitch-b.pitch);
    const q=parsed.division, beatTicks=q*4/meter.den, barTicks=beatTicks*meter.num;
    const totalTicks=Math.max(parsed.maxTick,...events.map(e=>e.endTick));const bars=Math.max(1,Math.ceil(totalTicks/barTicks));const grouped=Array.from({length:bars},()=>[]);
    const snap=t=>Math.max(0,Math.round(t/(q/4))*(q/4));
    events.forEach(e=>{const tick=snap(e.tick),bar=Math.min(bars-1,Math.floor(tick/barTicks)),pos=tick-bar*barTicks;grouped[bar].push({...e,position:pos,duration:Math.max(q/4,snap(e.endTick)-snap(e.tick))});});
    return {part,bars:grouped.map((items)=>{items.sort((a,b)=>a.position-b.position);const byPos=new Map();items.forEach(e=>{const k=Math.round(e.position);if(!byPos.has(k))byPos.set(k,[]);byPos.get(k).push(e);});const tokens=[];let cursor=0;for(const [tick,notes] of [...byPos.entries()].sort((a,b)=>a[0]-b[0])){if(tick>cursor+q/8){const gap=(tick-cursor)/q;tokens.push({text:durationToken(gap,'0'),raw:'0',rest:true});}const symbols=[...new Set(notes.map(n=>solfa(n.pitch,tonic).symbol))];const dur=Math.max(...notes.map(n=>n.duration))/q;const sym=symbols.length>1?`[${symbols.join(' ')}]`:symbols[0];tokens.push({text:durationToken(dur,sym),raw:sym});cursor=Math.max(cursor,tick+Math.max(...notes.map(n=>n.duration)));}return tokens;})};
  }
  function renderScore(){const tonic=PC[el.do.value],meter=selectedMeter();const assignments=new Map([...el.assignments.querySelectorAll('select')].map(s=>[Number(s.dataset.track),s.value]));const chosen=PARTS.slice(0,5).map(p=>buildPart(p,assignments,meter,tonic)).filter(Boolean);if(!chosen.length){status('Belum ada track yang dimasukkan ke part. Pilih setidaknya satu part.','error');return;}
    const title=el.title.value.trim()||'Karya Angklung';el.scoreTitle.textContent=title;const bpm=Math.round(60000000/parsed.tempo);el.meta.textContent=`DO = ${el.do.value} · Birama ${meter.num}/${meter.den} · Tempo MIDI ≈ ${bpm} BPM · ${chosen.reduce((n,p)=>n+p.bars.length,0)} tampilan birama`;
    el.output.replaceChildren();let textLines=[title,`DO = ${el.do.value} | Birama ${meter.num}/${meter.den} | Tempo sekitar ${bpm} BPM`,''];
    chosen.forEach(part=>{const sheet=document.createElement('article');sheet.className='part-sheet';const h=document.createElement('h3');h.textContent=part.part;const sub=document.createElement('div');sub.className='part-subtitle';sub.textContent=`DO = ${el.do.value} · Birama ${meter.num}/${meter.den}`;const grid=document.createElement('div');grid.className='measure-grid';const line=[part.part];part.bars.forEach((tokens,i)=>{const m=document.createElement('div');m.className='measure';const n=document.createElement('span');n.className='measure-number';n.textContent=`Birama ${i+1}`;const notes=document.createElement('div');notes.className='measure-notes';if(!tokens.length){notes.className+=' empty-measure';notes.textContent='—';}else{tokens.forEach(tok=>{const span=document.createElement('span');span.className='token';span.textContent=tok.text;notes.append(span);});}m.append(n,notes);grid.append(m);line.push(`${i+1}. ${tokens.map(t=>t.text).join('  ')||'—'}`);});sheet.append(h,sub,grid);el.output.append(sheet);textLines.push(line[0]);part.bars.forEach((tokens,i)=>textLines.push(`Birama ${i+1}: ${tokens.map(t=>t.text).join('  ')||'—'}`));textLines.push('');});lastText=textLines.join('\n');el.scorePanel.classList.remove('hidden');status(`Konversi selesai: ${chosen.length} part ditampilkan. Periksa ulang notasi dan pembagian sebelum digunakan.`,'success');el.scorePanel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  el.file.addEventListener('change',async()=>{const file=el.file.files&&el.file.files[0];if(!file)return;try{status(`Membaca ${file.name}…`);midiData=await file.arrayBuffer();parsed=parseMidi(midiData);el.convert.disabled=false;el.title.value=file.name.replace(/\.midi?$/i,'').replace(/[_-]+/g,' ');if(el.meter.value==='auto'&&parsed.meter.num)status(`MIDI terbaca: ${parsed.tracks.length} track, resolusi ${parsed.division} ticks/quarter.`,'success');else status(`MIDI terbaca: ${parsed.tracks.length} track.`,'success');showTracks();}catch(err){parsed=null;el.convert.disabled=true;el.tracksPanel.classList.add('hidden');status(err.message||'Gagal membaca MIDI.','error');}});
  el.convert.addEventListener('click',()=>{if(!parsed)return;showTracks();status('Pilih pembagian track, lalu tekan “Terapkan pembagian & tampilkan partitur”.');});
  el.apply.addEventListener('click',()=>{if(parsed)renderScore();});
  el.meter.addEventListener('change',()=>{if(parsed)status('Birama diperbarui. Terapkan pembagian untuk membuat ulang partitur.');});
  el.do.addEventListener('change',()=>{if(parsed)status(`DO = ${el.do.value} dipilih. Tekan tombol penerapan untuk memperbarui partitur.`);});
  el.copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(lastText);status('Teks partitur berhasil disalin.','success');}catch{status('Clipboard tidak tersedia di browser ini. Gunakan Unduh .txt.','error');}});
  el.download.addEventListener('click',()=>{if(!lastText)return;const blob=new Blob([lastText],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(el.title.value.trim()||'partitur-laras').replace(/[^a-z0-9-_ ]/gi,'').replace(/\s+/g,'-')+'.txt';a.click();URL.revokeObjectURL(a.href);});
  el.print.addEventListener('click',()=>window.print());
  el.reset.addEventListener('click',()=>{midiData=null;parsed=null;lastText='';el.file.value='';el.convert.disabled=true;el.tracksPanel.classList.add('hidden');el.scorePanel.classList.add('hidden');el.assignments.replaceChildren();el.title.value='Karya Angklung';el.do.value='G';el.meter.value='auto';status('Pilih berkas MIDI untuk memulai.');});
})();
