import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fixture } from './fixtures.mjs';
test('MCP handshake, permissions, submit and polling work end to end',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'qingye-mcp-')),data=path.join(root,'data'),allowed=path.join(root,'allowed');await fs.mkdir(data);await fs.mkdir(allowed);
  const outside=path.join(root,'outside.pdf'),input=path.join(allowed,'input.pdf');await fs.writeFile(outside,fixture());await fs.writeFile(input,fixture());
  await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({roots:[allowed],engines:{}}));
  const transport=new StdioClientTransport({command:process.env.QINGYE_PACKAGED_APP||process.execPath,args:process.env.QINGYE_PACKAGED_APP?['--mcp']:['scripts/mcp-server.mjs'],env:{...process.env,QINGYE_DATA_DIR:data},stderr:'pipe'});
  let errors='';transport.stderr?.on('data',d=>errors+=d.toString());
  const client=new Client({name:'test-client',version:'1.0.0'});await client.connect(transport);
  try{
    assert.equal((await client.listTools()).tools.length,4);
    const denied=await client.callTool({name:'submit_task',arguments:{operation:'pdf_compress',inputs:[outside],outputDir:allowed}});assert.equal(denied.isError,true);
    await fs.symlink(outside,path.join(allowed,'escape.pdf'));
    const escape=await client.callTool({name:'submit_task',arguments:{operation:'pdf_compress',inputs:[path.join(allowed,'escape.pdf')],outputDir:allowed}});assert.equal(escape.isError,true);
    const submitted=await client.callTool({name:'submit_task',arguments:{operation:'pdf_compress',inputs:[input],outputDir:allowed}});assert(!submitted.isError,JSON.stringify(submitted)+errors);const {jobId}=submitted.structuredContent;
    let status;
    for(let i=0;i<200;i++){const r=await client.callTool({name:'task_status',arguments:{jobId}});status=r.structuredContent;if(status.status!=='running')break;await new Promise(r=>setTimeout(r,50));}
    assert.equal(status.status,'completed',JSON.stringify(status)+errors);assert((await fs.stat(status.results[0].outputs[0])).size>0);
    await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({roots:[],engines:{}}));
    const revoked=await client.callTool({name:'submit_task',arguments:{operation:'pdf_compress',inputs:[input],outputDir:allowed}});assert.equal(revoked.isError,true);
  }finally{await client.close();}
});
