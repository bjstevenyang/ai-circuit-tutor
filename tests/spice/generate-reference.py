"""Offline independent ngspice reference. Requires the approved native CLI, never used by production."""
from pathlib import Path
import hashlib,json,math,re,struct,subprocess,sys,tempfile
root=Path(__file__).parent
paths=sorted(root.glob('*.cir'))
strict='--strict' in sys.argv[1:]
names=[arg for arg in sys.argv[1:] if arg!='--strict']
if strict and names!=['reference-240k']:raise SystemExit('--strict requires the reference-240k fixture')
if names:
    requested=set(names);paths=[p for p in paths if p.stem in requested]
    if requested!={p.stem for p in paths}:raise SystemExit('Unknown fixture name')

def oscillation(rows,columns):
    di=columns.index('v(d)');si=columns.index('v(s)')
    wave=[(r[0],r[di]-r[si]) for r in rows]
    tail=[v for t,v in wave if t>=.005];lo,hi=min(tail),max(tail)
    if hi-lo<.002:raise ValueError('No measurable periodic signal')
    level=(lo+hi)/2;crossings=[];armed=False
    for (ta,va),(tb,vb) in zip(wave,wave[1:]):
        if ta<.005:continue
        if vb<level-(hi-lo)*.1:armed=True
        if armed and va<level<=vb:
            crossings.append(ta+(tb-ta)*(level-va)/(vb-va));armed=False
    if len(crossings)<5:raise ValueError('Fewer than four observed cycles')
    times=crossings[-5:];periods=[b-a for a,b in zip(times,times[1:])];rms=[]
    for start,end in zip(times,times[1:]):
        area=square=0
        for (ta,va),(tb,vb) in zip(wave,wave[1:]):
            a,b=max(start,ta),min(end,tb)
            if b<=a:continue
            v0=va+(vb-va)*(a-ta)/(tb-ta);v1=va+(vb-va)*(b-ta)/(tb-ta)
            area+=(b-a)*(v0+v1)/2
            square+=(b-a)*(v0*v0+v0*v1+v1*v1)/3
        rms.append(math.sqrt(max(0,square/(end-start)-(area/(end-start))**2)))
    period=sum(periods)/4;ac=sum(rms)/4
    if any(abs(p/period-1)>.01 for p in periods) or any(abs(v/ac-1)>.01 for v in rms):raise ValueError('Cycles have not stabilized')
    return {'risesAfter5ms':len(crossings),'lastFourPeriodsS':periods,'frequencyHz':1/period,'lastFourAcRmsV':rms,'acRmsV':ac}

for path in paths:
    with tempfile.TemporaryDirectory(prefix='circuit-spice-') as directory:
        netlist=path
        if strict:
            netlist=Path(directory)/'strict.cir'
            text=path.read_text().replace('reltol=1e-4 vntol=10u abstol=1n','reltol=1e-6 vntol=100n abstol=10p').replace('.tran .25u 40m 0 .25u uic','.tran .125u 40m 0 .125u uic')
            netlist.write_text(text)
        raw=Path(directory)/'out.raw';log=Path(directory)/'run.log'
        subprocess.run(['ngspice','-b','-r',str(raw),'-o',str(log),str(netlist)],check=True,capture_output=True)
        header,data=raw.read_bytes().split(b'Binary:\n',1)
        n=int(re.search(rb'No. Variables:\s*(\d+)',header)[1]); rows=list(struct.iter_unpack('<'+'d'*n,data))
        columns=[line.split()[1] for line in header.decode().split('Variables:\n')[1].strip().splitlines()]
        targets=[.0001,.0005,.001,.005,.01,.02,.035,.04] if path.stem.startswith('reference') else [1e-6,2.01e-6,3e-6,10e-6,12e-6,12.01e-6,12.1e-6,13e-6,19e-6]
        samples=[list(min(rows,key=lambda r:abs(r[0]-t))) for t in targets]
        result={'engine':subprocess.check_output(['ngspice','--version'],text=True).splitlines()[1],'command':'python3 tests/spice/generate-reference.py'+(' '+' '.join(sys.argv[1:]) if sys.argv[1:] else ''),'sha256':hashlib.sha256(netlist.read_bytes()).hexdigest(),'columns':columns,'samples':samples,'toleranceV':.001}
        if path.stem=='reference-240k':result['oscillation']=oscillation(rows,columns)
        path.with_name(path.stem+('-strict' if strict else '')+'-summary.json').write_text(json.dumps(result,indent=2)+'\n')
