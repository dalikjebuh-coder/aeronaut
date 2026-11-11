import urllib.request,urllib.parse,json,csv,io,re,concurrent.futures
from pathlib import Path
from html import unescape
root=Path(__file__).resolve().parents[1]
headers={'User-Agent':'FlyAtlasFlightSimulator/0.1 (local educational flight game; photo attribution preserved)'}
def fetch(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=35) as r:return r.read(),r.headers.get('Content-Type','')
def api(host,params):return json.loads(fetch('https://'+host+'/w/api.php?'+urllib.parse.urlencode({'action':'query','format':'json','formatversion':2,**params}))[0])['query']['pages']
def plain(value):return re.sub(r'\s+',' ',unescape(re.sub('<[^>]+>','',value))).strip()
entries=[('madeira','Madeira','PORTUGAL','Madeira_Airport','LPMA'),('gibraltar','Gibraltar','GIBRALTAR','Gibraltar_International_Airport','LXGB'),('innsbruck','Innsbruck','RAKOUSKO','Innsbruck_Airport','LOWI'),('stmaarten','Sint Maarten','KARIBIK','Princess_Juliana_International_Airport','TNCM'),('queenstown','Queenstown','NOVÝ ZÉLAND','Queenstown_Airport','NZQN'),('santos-dumont','Rio · Santos Dumont','BRAZÍLIE','Santos_Dumont_Airport','SBRJ'),('kansai','Ósaka · Kansai','JAPONSKO','Kansai_International_Airport','RJBB'),('sfo-arrival','San Francisco · letiště','USA','San_Francisco_International_Airport','KSFO'),('sydney-harbour','Sydney','AUSTRÁLIE','Sydney_Opera_House',None),('cape-peninsula','Kapské Město','JIŽNÍ AFRIKA','Table_Mountain',None),('monument-valley','Monument Valley','USA','Monument_Valley',None),('iguazu','Iguazú','ARGENTINA / BRAZÍLIE','Iguazu_Falls',None)]
rows=list(csv.DictReader(io.StringIO(fetch('https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/runways.csv')[0].decode())))
wanted={x[4] for x in entries if x[4]}
rows=[x for x in rows if x['airport_ident'] in wanted and x['closed']=='0']
(root/'src/expedition-runways.json').write_text(json.dumps(rows,indent=2)+'\n')
print('Runways',len(rows),flush=True)
pages=api('en.wikipedia.org',{'prop':'pageimages','piprop':'thumbnail|name','pilicense':'free','pithumbsize':960,'titles':'|'.join(x[3] for x in entries)})
by_title={p['title'].replace(' ','_'):p for p in pages}
overrides={'Princess_Juliana_International_Airport':'Maho Beach, near Princess Juliana Airport, Caribbean island of Saint Martin-8Feb2008 (4).jpg','Madeira_Airport':'Aeroporto da Madeira3.JPG','Innsbruck_Airport':'12-06-05-innsbruck-by-ralfr-165.jpg'}
for title,name in overrides.items():by_title[title]['pageimage']=name
files=[p['pageimage'] for p in pages if p.get('pageimage')]
infos={}
for start in range(0,len(files),4):
 for page in api('commons.wikimedia.org',{'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':960,'iiextmetadatafilter':'Artist|LicenseShortName|LicenseUrl','titles':'|'.join('File:'+f for f in files[start:start+4])}):
  if page.get('imageinfo'):infos[page['title'].removeprefix('File:').replace('_',' ')]=page['imageinfo'][0]
def build(entry):
 id,name,country,title,icao=entry;p=by_title[title];f=p['pageimage'];info=infos[f.replace('_',' ')];meta=info['extmetadata'];url=info['thumburl'];content,mime=fetch(url)
 if not mime.startswith('image/'):raise RuntimeError(mime)
 suffix='.png' if 'png' in mime else '.webp' if 'webp' in mime else '.jpg'
 path=root/'src/images'/('world-'+id+'-v1'+suffix);path.write_bytes(content)
 result={'id':id,'name':name,'country':country,'image':'/images/'+path.name,'credit':plain(meta['Artist']['value']),'license':plain(meta['LicenseShortName']['value']),'licenseUrl':meta.get('LicenseUrl',{}).get('value',info['descriptionurl']),'source':info['descriptionurl'],'photoFile':f,'icao':icao}
 print('Photo',id,result['license'],flush=True);return id,result
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:result=dict(pool.map(build,entries))
(root/'src/expedition-places.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')

choices={'madeira':('LPMA','05'),'gibraltar':('LXGB','09'),'innsbruck':('LOWI','26'),'stmaarten':('TNCM','10'),'queenstown':('NZQN','05'),'santos-dumont':('SBRJ','02R'),'kansai':('RJBB','06R'),'sfo-arrival':('KSFO','28R')}
# TNCM's upstream 96° is magnetic; the geographic route needs the 81.5° true course.
true_heading_overrides={'stmaarten':81.5}
airports={}
for id,(icao,end) in choices.items():
 r=next(r for r in rows if r['airport_ident']==icao and end in [r['le_ident'],r['he_ident']]);prefix='le' if end==r['le_ident'] else 'he'
 airports[id]={'icao':icao,'runway':end,'lat':float(r[prefix+'_latitude_deg']),'lon':float(r[prefix+'_longitude_deg']),'heading':true_heading_overrides.get(id,float(r[prefix+'_heading_degT'])),'length':round(float(r['length_ft'])*.3048),'width':round(float(r['width_ft'])*.3048),'displaced':round(float(r[prefix+'_displaced_threshold_ft'] or 0)*.3048)}
(root/'src/expedition-data.js').write_text('// Public-domain runway geometry: OurAirports, downloaded 2026-11-02.\n// Photo attribution: Wikimedia Commons, see each source and license link.\nexport const EXPEDITION_PLACES='+json.dumps(result,ensure_ascii=False,indent=2)+';\nexport const EXPEDITION_AIRPORTS='+json.dumps(airports,ensure_ascii=False,indent=2)+';\n')
