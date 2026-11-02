export const MISSION_CAPTIONS={
  brno:'Od Petrova přes Špilberk až k přehradě.',prague:'Sleduj Vltavu mezi pražskými mosty.',sf:'Přes Alcatraz k mostu Golden Gate.',paris:'Noční let podél Seiny.',nyc:'Podél Manhattanu až k Soše svobody.',everest:'Oblétni ledovce pod střechou světa.',giza:'Mezi pyramidami a Sfingou.',grandcanyon:'Proleť zákruty řeky Colorado.',matterhorn:'Kolem ostrých alpských hřebenů.',fuji:'Ranní okruh podél sopečných svahů.',rio:'Od oceánu k vrcholům nad Riem.',iceland:'Přes zelená údolí k vodopádu Skógafoss.',
  'brno-discovery':'Najdi pět památek. Bez závodu s časem.','brno-landing':'Srovnej přiblížení a měkce dosedni.','canyon-patrol':'Drž se nízko. Sleduj řeku mezi skalami.'
};
export function missionCaption(mission){
  if(mission.fixedRoute)return mission.description;
  const objective=mission.route.objective;
  if(objective?.type==='sightseeing')return 'Proleť nad pěti památkami. Každý průlet je přidá do sbírky.';
  if(objective?.type==='landing')return 'Proleť naváděcí brány a přistaň do vyznačené zóny.';
  if(objective?.type==='lowflight')return `Drž výšku ${objective.minHeight}–${objective.maxHeight} m a sleduj řeku.`;
  return MISSION_CAPTIONS[mission.id]||mission.description;
}
