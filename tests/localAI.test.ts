import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { generateContent, getAIStatus, Type } from '../server/localAI.ts';

let server: Server;
let app: ChildProcess;
let latest: any;
let fakeStatus = 200;
before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/api/tags') return void res.end(JSON.stringify({models: [{name: 'vision-test'}]}));
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      latest = JSON.parse(body);
      res.writeHead(fakeStatus, {'content-type': 'application/json'});
      res.end(JSON.stringify(fakeStatus === 200 ? {message: {content: latest.format ? '["topic"]' : 'hello'}} : {error: 'model missing'}));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  process.env.OLLAMA_URL = `http://127.0.0.1:${port}`;
  process.env.OLLAMA_MODEL = 'vision-test';
  process.env.OLLAMA_CONTEXT = '65536';
  app = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {env: {...process.env, PORT: '3119', NODE_ENV: 'production'}, stdio: 'pipe'});
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server did not start')), 10000);
    app.stdout!.on('data', chunk => { if (chunk.toString().includes('Server running')) {clearTimeout(timeout); resolve();} });
    app.once('exit', code => reject(new Error(`server exited ${code}`)));
  });
});
after(async () => { app.kill(); await new Promise<void>(resolve => server.close(() => resolve())); });

test('passes system text, images, temperature and JSON schema to Ollama without a key', async () => {
  const result = await generateContent({model: 'vision-test', contents: {parts: [{text: 'Lecture'}, {inlineData: {mimeType:'image/jpeg', data:'aGVsbG8='}}]}, config: {systemInstruction:'Instructions', temperature:0.2, responseMimeType:'application/json', responseSchema: {type: Type.ARRAY, items: {type: Type.STRING}}}});
  assert.equal(result.text, '["topic"]');
  assert.equal(latest.messages[0].content, 'Instructions');
  assert.deepEqual(latest.messages[1].images, ['aGVsbG8=']);
  assert.deepEqual(latest.format, {type:'array',items:{type:'string'}});
  assert.equal(latest.options.temperature, 0.2);
  assert.equal(latest.stream, false);
});

test('reports configured model and refuses silently dropped excessive images', async () => {
  assert.equal((await getAIStatus()).ready, true);
  process.env.OLLAMA_MAX_IMAGES = '1';
  await assert.rejects(generateContent({model:'vision-test',contents:[{inlineData:{mimeType:'image/jpeg',data:'a'}},{inlineData:{mimeType:'image/jpeg',data:'b'}}]}), /عدد الصفحات/);
  delete process.env.OLLAMA_MAX_IMAGES;
});

test('real application API uses the local provider and surfaces model errors', async () => {
  let response = await fetch('http://127.0.0.1:3119/api/ai/status');
  assert.equal((await response.json() as any).ready, true);
  response = await fetch('http://127.0.0.1:3119/api/gemini/translate', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({text:'test'})});
  assert.deepEqual(await response.json(), {result:'hello'});
  assert.equal(latest.model, 'vision-test');
  fakeStatus = 404;
  response = await fetch('http://127.0.0.1:3119/api/gemini/analyze-matches', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({mode:'summary',lectureFiles:[{name:'a.txt',text:'content'}]})});
  assert.equal(response.status, 500);
  assert.match((await response.json() as any).error, /غير موجود/);
  fakeStatus = 200;
});
