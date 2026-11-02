import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nearbyCities} from '../src/city-labels.js';

test('local city data places Prague near the Prague start',async()=>{
  const cities=JSON.parse(await readFile(new URL('../src/cities.json',import.meta.url)));
  const visible=nearbyCities(cities,50.0755,14.4378);
  assert(visible.some(city=>city.name==='Prague'));
  assert.equal(visible.length,36);
  const brno=nearbyCities(cities,49.1951,16.6068);
  assert(brno.length>=8);
  assert(brno.some(city=>city.name==='Blansko'));
});
test('nearby city selection handles the date line and removes crowded labels',()=>{
  const cities=[['East',0,179.99,100000],['West',0,-179.99,50000],['Far',0,178,1000000]];
  assert.deepEqual(nearbyCities(cities,0,179.995).map(city=>city.name),['East']);
});
