"""Offline independent ngspice reference. Requires the approved native CLI, never used by production."""
from pathlib import Path
import hashlib,json,re,struct,subprocess,tempfile
root=Path(__file__).parent
for path in sorted(root.glob('*.cir')):
    with tempfile.TemporaryDirectory(prefix='circuit-spice-') as directory:
        raw=Path(directory)/'out.raw';log=Path(directory)/'run.log'
        subprocess.run(['ngspice','-b','-r',str(raw),'-o',str(log),str(path)],check=True,capture_output=True)
        header,data=raw.read_bytes().split(b'Binary:\n',1)
        n=int(re.search(rb'No. Variables:\s*(\d+)',header)[1]); rows=list(struct.iter_unpack('<'+'d'*n,data))
        columns=[line.split()[1] for line in header.decode().split('Variables:\n')[1].strip().splitlines()]
        targets=[.0001,.0005,.001,.005,.01,.02,.035,.04] if path.stem=='reference' else [1e-6,2.01e-6,3e-6,10e-6,12e-6,12.01e-6,12.1e-6,13e-6,19e-6]
        samples=[list(min(rows,key=lambda r:abs(r[0]-t))) for t in targets]
        result={'engine':subprocess.check_output(['ngspice','--version'],text=True).splitlines()[1],'command':'python3 tests/spice/generate-reference.py','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'columns':columns,'samples':samples,'toleranceV':.001}
        path.with_name(path.stem+'-summary.json').write_text(json.dumps(result,indent=2)+'\n')
