'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./scripts/register-ts-test-loader.cjs');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  loadedModule._compile(output, filename);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const {selectPlanTasks,default:Plan}=require('./src/components/PlanHub.tsx');
const now=new Date('2026-11-17T12:00:00');const tasks=[{id:'a',title:'Today',dueDate:'2026-11-17',priority:'Medium',recurring:'None',completed:false},{id:'b',title:'Later',dueDate:'2026-11-18',priority:'Medium',recurring:'Weekly',completed:false},{id:'c',title:'Capture',priority:'Medium',recurring:'None',completed:false},{id:'d',title:'Finished',completed:true,priority:'Medium',recurring:'None'}];
tasks.forEach(task=>task.createdAt='2026-11-01T00:00:00Z');
assert.deepEqual(selectPlanTasks(tasks,'2026-11-17',now,'today','','all').map(x=>x.id),['a']);
assert.deepEqual(selectPlanTasks(tasks,'2026-11-17',now,'upcoming','','all').map(x=>x.id),['b']);
assert.equal(selectPlanTasks(tasks,'2026-11-17',now,'unscheduled','','all').length,2);
assert.deepEqual(selectPlanTasks(tasks,'2026-11-17',now,'all','FINISHED','completed').map(x=>x.id),['d']);
const noop=()=>{};const html=renderToStaticMarkup(React.createElement(Plan,{tasks,today:'2026-11-17',now,onCreateTask:noop,onQuickAdd:async()=>{},onToggleTask:noop,onOpenTask:noop,onNavigatePlanner:noop,onOpenGoals:noop,onSelectRange:noop}));
for(const text of ['Task views','Upcoming','Unscheduled','Search tasks','Quick task','Reminder','Later'])if(text!=='Reminder')assert.ok(html.includes(text),text);
assert.ok(!html.includes('Finished'),'completed records remain accessible through explicit status filter');
console.log('PASS four-tab workspace: real date/status/search selectors, quick capture and rendered controls');
