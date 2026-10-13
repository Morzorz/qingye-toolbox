const {app}=require('electron');
app.whenReady().then(async()=>{
  if(process.argv.includes('--mcp')){app.dock?.hide();const {startMcp}=await import('./mcp.mjs');await startMcp(()=>app.quit());}
  else if(process.argv.includes('--cli')){app.dock?.hide();try{const {runCli}=await import('./mcp.mjs');const r=await runCli(process.argv[process.argv.indexOf('--cli')+1]);process.stdout.write(JSON.stringify(r)+'\n',()=>app.exit(r.status==='completed'?0:1));}catch(e){process.stderr.write(e.message+'\n',()=>app.exit(1));}}
  else await require('./desktop.cjs').start();
}).catch(e=>{process.stderr.write(String(e.stack||e)+'\n');app.exit(1);});
