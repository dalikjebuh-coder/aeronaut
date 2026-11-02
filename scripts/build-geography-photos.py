"""Fetch freely licensed lead photos and attribution for the fixed discovery catalogue."""
import json, re, time, urllib.parse, urllib.request
from pathlib import Path
from html import unescape

root=Path(__file__).resolve().parents[1]
seeds=json.loads((root/'src/geography-places.json').read_text())
target=root/'src/images/places';target.mkdir(exist_ok=True)
headers={'User-Agent':'AeronautFlightSimulator/0.1 (local personal educational application)'}
def get(url):
 for attempt in range(4):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=20) as response:return response.read(),response.headers.get('Content-Type','')
  except Exception:
   if attempt==3:raise
   time.sleep(2*(attempt+1))
def plain(value):return re.sub(r'\s+',' ',unescape(re.sub('<[^>]+>','',value))).strip()
lead_params={'action':'query','format':'json','formatversion':'2','prop':'pageimages','piprop':'thumbnail|name','pilicense':'free','pithumbsize':'640','pageids':'|'.join(point['id'].split(':')[1] for point in seeds)}
lead=json.loads(get('https://cs.wikipedia.org/w/api.php?'+urllib.parse.urlencode(lead_params))[0])['query']['pages']
by_id={str(page['pageid']):page for page in lead}
metadata={}
files=[page['pageimage'] for page in lead if page.get('pageimage')]
for start in range(0,len(files),5):
 params={'action':'query','format':'json','formatversion':'2','prop':'imageinfo','iiprop':'url|extmetadata','iiextmetadatafilter':'Artist|LicenseShortName|LicenseUrl|AttributionRequired|Credit','titles':'|'.join('File:'+name for name in files[start:start+5])}
 data=json.loads(get('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params))[0])
 for page in data.get('query',{}).get('pages',[]):
  if page.get('imageinfo'):metadata[page['title'].removeprefix('File:').replace('_',' ')]=page['imageinfo'][0]
print('Attribution received:',len(metadata),flush=True)
for index,point in enumerate(seeds):
 if point['id']=='cs:4153' and point.get('photo',{}).get('file')=='Brno_Spilberk_vyhled_Petrov.jpg':continue
 page=by_id[point['id'].split(':')[1]];name=page['pageimage'];info=metadata.get(name.replace('_',' '))
 if not info:raise RuntimeError('Missing attribution: '+name)
 ext=info.get('extmetadata',{});license_name=plain(ext.get('LicenseShortName',{}).get('value',''))
 if not license_name:raise RuntimeError('Missing licence: '+name)
 remote=page['thumbnail']['source'];suffix='.png' if '.png' in remote.lower() else '.jpg'
 filename='wiki-'+point['id'].replace(':','-')+suffix;path=target/filename
 if not path.exists():
  content,mime=get(remote)
  if not mime.startswith('image/'):raise RuntimeError('Invalid media: '+name)
  path.write_bytes(content)
 point['photo']={'src':'/images/places/'+filename,'file':name,'url':info['descriptionurl'],'credit':plain(ext.get('Artist',{}).get('value','Wikimedia Commons')),'license':license_name,'licenseUrl':ext.get('LicenseUrl',{}).get('value',''),'remote':remote}
 print(index+1,point['name'],license_name,flush=True)
(root/'src/geography-places.json').write_text(json.dumps(seeds,ensure_ascii=False,indent=2)+'\n')
