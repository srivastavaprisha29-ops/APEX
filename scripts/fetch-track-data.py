"""Refresh attributable circuit geometry and a bounded historical timing snapshot."""
import urllib.request,json,datetime,math,time
from pathlib import Path
OUT=Path(__file__).resolve().parents[1]/'dist/data'
OUT.mkdir(exist_ok=True)
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'APEX-Educational-Explorer/1.0'}),timeout=25) as response:return json.load(response)
base='https://api.jolpi.ca/ergast/f1/'
circuits=get(base+'circuits/?limit=100')['MRData']['CircuitTable']['Circuits']
geo=get('https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson')
(OUT/'circuit-layouts.geojson').write_text(json.dumps(geo,separators=(',',':')))
for filename in ['LICENSE.md']:
    with urllib.request.urlopen('https://raw.githubusercontent.com/bacinger/f1-circuits/master/'+filename,timeout=25) as r:(OUT/'CIRCUIT-LICENSE.md').write_bytes(r.read())
print('circuits',len(circuits),'layouts',len(geo['features']),flush=True)
print('first layout',str(geo['features'][0]['properties']),flush=True)
calendar=[]
try:calendar=get(base+'2026/?limit=100')['MRData']['RaceTable']['Races']
except Exception as error:print('2026 calendar unavailable:',error,flush=True)
seasons={}
for year in [2023,2024,2025,2026]:
    try:
        merged={}
        constructors=['red_bull']+(['mclaren'] if year==2024 else [])
        for constructor in constructors:
            offset=0
            while True:
                raw=get(base+str(year)+'/constructors/'+constructor+'/results/?limit=100&offset='+str(offset))['MRData']
                received=0
                for race in raw['RaceTable']['Races']:
                    received+=len(race.get('Results',[]))
                    key=race['round']
                    if key not in merged:merged[key]={**race,'Results':[]}
                    merged[key]['Results'].extend(race.get('Results',[]))
                offset+=received
                if offset>=int(raw['total']) or received==0:break
        races=sorted(merged.values(),key=lambda r:int(r['round']))
        # Keep racing fields only, excluding unrelated driver personal metadata.
        seasons[str(year)]=[dict(season=r['season'],round=r['round'],raceName=r['raceName'],date=r['date'],circuitId=r['Circuit']['circuitId'],url=r['url'],results=[dict(driver=x['Driver']['givenName']+' '+x['Driver']['familyName'],code=x['Driver'].get('code',''),constructor=x['Constructor']['constructorId'],constructorName=x['Constructor']['name'],position=x['position'],grid=x.get('grid'),status=x.get('status'),laps=x.get('laps'),fastestLap=x.get('FastestLap')) for x in r.get('Results',[])]) for r in races]
        print(year,len(races),'races',flush=True)
    except Exception as error:seasons[str(year)]=[];print(year,'unavailable:',error,flush=True)
(OUT/'racing-snapshot.json').write_text(json.dumps(dict(fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),source=base,circuits=circuits,calendar2026=[dict(circuitId=r['Circuit']['circuitId'],raceName=r['raceName'],date=r['date'],round=r['round']) for r in calendar],seasons=seasons),separators=(',',':')))
