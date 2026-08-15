# Local patches

## Disable telemetry transport (Task 7)

The upstream browser bundle included a telemetry transport which used `fetch` to
POST usage data to a Google endpoint. The game must remain fully self-hosted at
play time, so the transport now reports successful completion without making a
network request. The task API exports, WASM path resolution, and local model
loading are not changed.

The following deterministic, one-occurrence replacements were made in each
one-line minified artifact. The source-map replacements mirror the runtime
changes so neither artifact retains the endpoint literal.

### `vision_bundle.mjs`

Transport implementation:

```text
old: Eh=class{constructor(){this.g="undefined"!=typeof AbortController}async send(t,e,r){var n=this.g?new AbortController:void 0,i=n&&t.la>0?setTimeout(()=>{n.abort()},t.la):void 0;try{let i=await fetch(t.url,{method:t.bb,headers:{...t.ab},...t.body&&{body:t.body},...t.withCredentials&&{credentials:"include"},signal:t.la&&n?n.signal:null});200===i.status?e?.(await i.text()):r?.(i.status)}catch(t){if("AbortError"===t?.name)r?.(408);else r?.(400)}finally{clearTimeout(i)}}}
new: Eh=class{async send(t,e,r){e?.()}}
```

Endpoint configuration:

```text
old: url:"https://odml.pa.googleapis.com/v1/log"
new: url:""
```

### `vision_bundle.mjs.map`

Transport implementation:

```text
old: Aj=class{constructor(){this.g=typeof AbortController!==\"undefined\"}async send(a,b,c){var d=this.g?new AbortController:void 0,e=d&&a.la>0?setTimeout(()=>{d.abort()},a.la):void 0;try{let f=await fetch(a.url,{method:a.bb,headers:{...a.ab},...(a.body&&{body:a.body}),...(a.withCredentials&&{credentials:\"include\"}),signal:a.la&&d?d.signal:null});f.status===200?b?.(await f.text()):c?.(f.status)}catch(f){switch(f?.name){case \"AbortError\":c?.(408);break;default:c?.(400)}}finally{clearTimeout(e)}}}
new: Aj=class{async send(a,b,c){b?.()}}
```

Endpoint configuration:

```text
old: url:\"https://odml.pa.googleapis.com/v1/log\"
new: url:\"\"
```

Rationale: the replacement preserves the transport call's success callback and
its asynchronous method interface, while removing `fetch`, timeout handling,
credentials, and the only remote telemetry endpoint literal from the vendored
ES module and its local source map.
