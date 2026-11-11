import {MISSION_PLACES} from './mission-places.js';

// Scenic course design, not navigation data. Per-gate heights are resolved from the 3D surface.
const courses=[
  {id:'everest',title:'Ve stínu Everestu',description:'Himálajský okruh nad ledovci Rongbuk a pod severní stěnou Everestu.',time:'morning',weather:'clear',difficulty:'Himálajské ledovce',altitude:7500,radius:260,clearance:1000,
    challenge:'Nízký horský slalom u severní stěny. Sleduj reliéf ledovce a počítej se stoupáním mezi hřebeny.',
    easy:[[28.075,86.86,'Západní Rongbuk'],[28.095,86.90,'Nad ledovcem'],[28.075,86.96,'Východní Rongbuk'],[28.025,86.985,'Severovýchodní hřeben'],[27.995,86.99,'Východní vyhlídka']],
    normal:[[28.06,86.88,'Rongbuk'],[28.035,86.907,'Severní údolí'],[28.045,86.943,'Ledovcový oblouk'],[28.012,86.963,'Pod hřebenem'],[27.998,86.949,'Everest zblízka']],
    hard:[[28.038,86.902,'Nástup na ledovec',180],[28.014,86.908,'Pod severní stěnou',100],[28.023,86.934,'Ledovcový slalom',220],[28.008,86.949,'Východní svah',95],[27.995,86.945,'Horský výlet',160]]},
  {id:'giza',title:'Strážci pouště',description:'Oblétni pyramidy v Gíze a najdi průlet mezi Sfingou a kamennými monumenty.',time:'evening',weather:'haze',difficulty:'Pyramidy a Sfinga',altitude:550,radius:200,clearance:450,
    challenge:'Průlet mezi Sfingou a Rachefovou pyramidou, obrat mezi pyramidami a nízký závěr nad pouští.',
    easy:[[29.971,31.142,'Pouštní nástup'],[29.9753,31.1376,'Sfinga'],[29.9792,31.1342,'Velká pyramida'],[29.976,31.1308,'Rachefova pyramida'],[29.972,31.125,'Západní poušť']],
    normal:[[29.972,31.141,'Nad pískem'],[29.9754,31.1365,'Západně od Sfingy'],[29.9805,31.135,'Sever Velké pyramidy'],[29.977,31.129,'Západní oblouk'],[29.972,31.128,'Menkaure']],
    hard:[[29.974,31.1405,'Přílet ke Sfinze',120],[29.9754,31.1355,'Mezi Sfingou a pyramidou',34],[29.9782,31.1323,'Mezera mezi pyramidami',85],[29.9807,31.134,'Severní obrat',32],[29.976,31.1281,'Pouštní únik',40]]},
  {id:'grandcanyon',title:'Stíny Colorada',description:'Od panoramatických vyhlídek do zatáček hlubokého kaňonu řeky Colorado.',time:'evening',weather:'clear',difficulty:'Řeka a skalní stěny',altitude:2500,radius:240,clearance:650,
    challenge:'Sestup do kaňonu, kopírování zákrut řeky a nízký průlet podél skalních stěn.',
    easy:[[36.058,-112.067,'Jižní okraj'],[36.083,-112.07,'Nad soutěskou'],[36.102,-112.095,'Phantom Ranch'],[36.103,-112.13,'Oblouk Colorada'],[36.128,-112.147,'Severní vyhlídka']],
    normal:[[36.073,-112.058,'Východní nástup'],[36.088,-112.077,'Sestup do kaňonu'],[36.101,-112.095,'Mosty nad Coloradem'],[36.098,-112.116,'Říční oblouk'],[36.113,-112.135,'Západní koridor']],
    hard:[[36.088,-112.063,'Říční nástup',150],[36.097,-112.079,'Východní zákrut',40],[36.101,-112.095,'U Phantom Ranch',90],[36.099,-112.111,'Pod skalní stěnou',34],[36.108,-112.129,'Západní zákrut',45]]},
  {id:'matterhorn',title:'Alpská hrana',description:'Od Zermattu přes horská údolí k ostré siluetě Matterhornu.',time:'day',weather:'partly',difficulty:'Alpské hřebeny',altitude:4500,radius:240,clearance:750,
    challenge:'Střídání svahů a sedel, přesné zatáčky u Hörnli a nízký závěr mezi alpskými hřebeny.',
    easy:[[46.019,7.73,'Zermattské údolí'],[45.997,7.76,'Gornergrat'],[45.976,7.74,'Východní vyhlídka'],[45.959,7.701,'Jižní oblouk'],[45.984,7.683,'Matterhorn']],
    normal:[[46.008,7.729,'Horský nástup'],[45.989,7.724,'Schwarzsee'],[45.995,7.695,'Pod hřebenem'],[45.979,7.685,'Hörnli'],[45.966,7.703,'Východní údolí']],
    hard:[[45.996,7.717,'Schwarzsee',180],[45.988,7.695,'Nástup na Hörnli',60],[45.978,7.68,'Pod Matterhornem',150],[45.973,7.699,'Hřebenový obrat',70],[45.962,7.717,'Ledovcový výlet',100]]},
  {id:'fuji',title:'Ranní Fudži',description:'Oblouk kolem sopečného kužele Fudži a let nad jeho lesnatými svahy.',time:'morning',weather:'partly',difficulty:'Sopka a lesní svahy',altitude:4500,radius:240,clearance:800,
    challenge:'Těsné oblouky podél sopečných svahů, střídání stran hřebene a prudší změny výšky.',
    easy:[[35.418,138.706,'Severní svahy'],[35.404,138.766,'Východní panorama'],[35.36,138.789,'Východní úbočí'],[35.319,138.746,'Jižní oblouk'],[35.348,138.686,'Západní vyhlídka']],
    normal:[[35.402,138.716,'Severní nástup'],[35.385,138.751,'Horní lesy'],[35.36,138.769,'Východní žlab'],[35.338,138.745,'Jižní svah'],[35.354,138.704,'Pod vrcholem']],
    hard:[[35.387,138.719,'Severní žlab',170],[35.372,138.742,'Východní hrana',80],[35.356,138.752,'Sopečný obrat',150],[35.343,138.731,'Jižní traverz',60],[35.361,138.706,'Západní hrana',100]]},
  {id:'rio',title:'Mezi mořem a horami',description:'Z Copacabany přes Cukrovou homoli až ke Kristu nad Riem.',time:'night',weather:'partly',difficulty:'Pobřeží a skalní věže',altitude:1400,radius:220,clearance:550,
    challenge:'Pobřežní slalom, ostrý obrat u Cukrové homole a stoupání ke Corcovadu.',
    easy:[[-22.986,-43.191,'Arpoador'],[-22.975,-43.181,'Copacabana'],[-22.948,-43.154,'Cukrová homole'],[-22.943,-43.181,'Botafogo'],[-22.952,-43.2105,'Corcovado']],
    normal:[[-22.982,-43.185,'Nástup z pláže'],[-22.964,-43.17,'Leme'],[-22.95,-43.16,'Homole zblízka'],[-22.943,-43.187,'Botafogský obrat'],[-22.952,-43.207,'Pod Kristem']],
    hard:[[-22.973,-43.178,'Copacabana',160],[-22.958,-43.166,'Leme',40],[-22.948,-43.158,'U Cukrové homole',100],[-22.942,-43.181,'Botafogo',38],[-22.953,-43.207,'Corcovado',170]]},
  {id:'iceland',title:'Islandská kaskáda',description:'Let nad zelenými údolími, hranou vodopádu Skógafoss a islandskými pláněmi.',time:'morning',weather:'overcast',difficulty:'Vodopád a údolí',altitude:1100,radius:220,clearance:500,
    challenge:'Nízký přílet podél říčky, obrat u vodopádu a stoupání podél hrany náhorní plošiny.',
    easy:[[63.51,-19.535,'Jižní pláně'],[63.529,-19.513,'Skógafoss'],[63.55,-19.501,'Horní kaskády'],[63.561,-19.465,'Zelené údolí'],[63.536,-19.456,'Východní vyhlídka']],
    normal:[[63.518,-19.526,'Říční nástup'],[63.53,-19.516,'U vodopádu'],[63.543,-19.506,'Hrana plošiny'],[63.549,-19.485,'Horní údolí'],[63.532,-19.477,'Východní sestup']],
    hard:[[63.52,-19.522,'Podél říčky',130],[63.529,-19.514,'Před Skógafossem',35],[63.535,-19.51,'Nad vodopádem',100],[63.543,-19.501,'Údolní obrat',38],[63.537,-19.486,'Zelená hrana',55]]}
];
function makeGates(nodes,clearance){return nodes.map(([lat,lon,name,height],index)=>({lat,lon,name:name+(index===0?' · START':index===nodes.length-1?' · CÍL':''),clearance:height??clearance}));}
export const WORLD_MISSIONS=courses.map(course=>({
  id:course.id,place:course.id,title:course.title,description:course.description,time:course.time,weather:course.weather,difficulty:course.difficulty,challenge:course.challenge,
  location:MISSION_PLACES[course.id],variants:{normal:course.normal,hard:course.hard},
  route:{id:course.id+'-landmarks-v1',radius:course.radius,altitude:course.altitude,terrainFollowing:true,gates:makeGates(course.easy,course.clearance)}
}));
