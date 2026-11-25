const fs=require('fs');
for(const f of process.argv.slice(2)){
  const b=fs.readFileSync(f); if(b.readUInt32LE(0)!==0x46546C67){console.log(f,'not glb');continue}
  const len=b.readUInt32LE(12); const j=JSON.parse(b.slice(20,20+len).toString());
  const anims=(j.animations||[]).map(a=>a.name);
  console.log(f.split(/[\\/]/).pop(), (b.length/1024|0)+'K', 'nodes',(j.nodes||[]).length,'mesh',(j.meshes||[]).map(m=>m.name).slice(0,5).join('|'),'mats',(j.materials||[]).map(m=>m.name).slice(0,6).join('|'),'skins',(j.skins||[]).length,'anims['+anims.length+']',anims.join(',').slice(0,400), JSON.stringify(j.asset).slice(0,160));
}
