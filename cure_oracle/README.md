# cure-oracle

> **Draft README (v0.1.0, for reserving the name).** The section layout may still change.

**Signed byte pointers for meshes, knots and market contracts.**

The Python core of **ChartUI / METADOGG ORACLE**. It reads knots from drawn curves, cuts meshes into parts and points at their best triangles byte by byte (`.meshmeta`), signs those pointers so nobody can change them unnoticed, and serves the `cure-initial/1` contract.

```bash
pip install cure-oracle            # knots and .meshmeta, no dependencies
pip install "cure-oracle[sign]"    # + Ed25519 signatures
pip install "cure-oracle[api]"     # + the FastAPI cure-initial/1 router
```

The distribution is called `cure-oracle` because `cure` on PyPI belongs to another project. The command is still `cure`.

## Command line

```bash
cure version
cure meshmeta model.stl out --key key.pem    # → out.stl + out.meshmeta (signed)
cure verify out.stl out.meshmeta --pub <hex>  # OK / INVALID (exit code 1)
```

## `.meshmeta` in one paragraph

An STL stores every triangle in 50 bytes. `.meshmeta` is a JSON file next to it that names the best four triangles of each part (A–D, ranked by the radius ratio 2r/R). For each one it records where that triangle's vertices start in the STL and how long they are:

```json
"Data": "[⏸️ (バイト): \"0x00A1\", ▶️ (バイト): \"36\"]"
```

⏸️ is where to start reading, ▶️ how many bytes to read. Any program can seek straight to those bytes without parsing the mesh.

## Signatures

`sign_meshmeta` signs `SHA-256(stl) ‖ canonical JSON of the meta` with Ed25519. Change one byte of the STL, or one pointer, and `verify_meshmeta` fails. The same signature can be checked in the browser with the npm package [`chartui`](https://www.npmjs.com/package/chartui) (`meshmeta.verifyMeshmeta`).

```python
import mesh_meta as mm
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

stl, meta = mm.build_meshmeta(vertices, triangles)
signed = mm.sign_meshmeta(stl, meta, Ed25519PrivateKey.generate())
assert mm.verify_meshmeta(stl, signed)
```

## Unknown coefficients and the zero

`cure-oracle` follows the same rule as `chartui`: an unknown value is never silently written as 0. When positions have to be kept without separators, the 0 is a placeholder and a mask records which zeros are placeholders. See the `chartui` README for the 22-slot strip.

## Status

0.1.0 reserves the name; the API may change before 1.0. Nothing here is trading or investment advice.

## Contributing

See [CONTRIBUTING.md](https://github.com/YTfromXXX/ChartUI/blob/main/CONTRIBUTING.md).

## License

MIT
