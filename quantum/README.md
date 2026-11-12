# IBM Quantum challenge (free plan)

Ask a real IBM QPU the same question the spin lab (`/lab/spin`) asks in the browser: one layer of
QAOA for the **hair** problem (10 qubits, a chain of 9 couplings: 18 two-qubit gates on an IBM chip)
or, as a stretch, the **flower** problem (10 qubits, all 45 pairs: about 180 two-qubit gates).

```bash
pip install -r quantum/requirements.txt
npm run quantum:export                                  # only if lib/spinLab.ts changed
python quantum/ibm_spin_challenge.py hair --mode local  # ideal, offline
python quantum/ibm_spin_challenge.py hair --mode fake   # noisy rehearsal on a fake IBM chip, offline
python quantum/ibm_spin_challenge.py hair --mode ibm    # real QPU (asks before submitting)
```

Save your IBM account once on your own machine; never commit the key:

```bash
python -c "from qiskit_ibm_runtime import QiskitRuntimeService as S; S.save_account(channel='ibm_quantum_platform', token='<API key>', instance='<CRN>')"
```

- One circuit, 4 000 shots: a few seconds of QPU time, well inside the free plan (as I understand it,
  10 minutes every 28 days — check IBM's current terms). `--max-shots` guards against typos.
- Checked here: the circuit's ideal probabilities equal the browser's QAOA to within 1e-10.
- Results land in `quantum/results/`; load the JSON in the spin lab to compare it with the ideal and
  the rehearsal. Commit a real-QPU result if you want it shown for everyone.
- This environment cannot reach IBM's servers, so the real-QPU step runs on your machine.
