# House disk audio

Small static file server for the house netfs share (`\\mlsfs\netfs`, volume `I:`).

It binds only to the mlsfs Tailscale address (`100.73.201.124` by default, any address in `100.64.0.0/10`). It will not listen on `0.0.0.0`, the LAN address, or a public address. Do not port-forward this port.

AWS, DNS, and the living site stay as they are. This is a tailnet copy path, not a replacement.

```
python serve.py --bind 100.73.201.124 --port 8765 --root I:\
```

A tailnet browser can then open `http://100.73.201.124:8765/`.
